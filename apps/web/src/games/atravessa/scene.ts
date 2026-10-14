import * as THREE from 'three';
import {
  ATR_HALF_COLS,
  ATR_TRAIN_LEN,
  AtravessaSim,
  atravessaMilestone,
  biomeAt,
  crocState,
  laneBiome,
  laneItems,
  trainState,
  turtleState,
  type AtravessaBiome,
  type AtravessaEnd,
  type BiomeInfo,
  type FlowItem,
  type Lane,
  type SweepView,
} from '@nocap/games';
import { HEADING, HERO_LOOK, deathPose, heroPose, turnToward, type Pose } from './hop';
import {
  bakeInto,
  box,
  buildHero,
  buildLog,
  buildPad,
  buildSignal,
  buildTrain,
  buildTree,
  darkness,
  disposeModels,
  disposeOwned,
  hash2,
  mat,
} from './models';
import {
  Burst,
  buildCroc,
  buildGate,
  buildBang,
  buildSweepHazard,
  buildSweepLine,
  buildTargetRing,
  buildTurtles,
} from './props';
import { buildVehicle } from './vehicles';

/** Quantas faixas ficam montadas atrás e à frente da câmera. */
const ROWS_BEHIND = 11;
const ROWS_AHEAD = 26;
/** Largura do chão de cada faixa: passa folgado da tela nos dois lados. */
const FLOOR_W = 36;

interface Palette {
  sky: THREE.Color;
  groundA: THREE.Color;
  groundB: THREE.Color;
  road: THREE.Color;
  roadEdge: THREE.Color;
  water: THREE.Color;
  /** Luz do sol (cor) e quanto ela vale. */
  sun: THREE.Color;
  sunPower: number;
  ambient: number;
}

const hex = (h: number) => new THREE.Color(h);
const PALETTES: Record<AtravessaBiome, Palette> = {
  horta: {
    sky: hex(0xbfe6ff),
    groundA: hex(0x8dd252),
    groundB: hex(0x7fc447),
    road: hex(0x4b4f5c),
    roadEdge: hex(0x6a6f7e),
    water: hex(0x58bdf2),
    sun: hex(0xfff4d6),
    sunPower: 2.3,
    ambient: 1.25,
  },
  deserto: {
    sky: hex(0xffddaa),
    groundA: hex(0xf0cd85),
    groundB: hex(0xe6bf72),
    road: hex(0x5d4d45),
    roadEdge: hex(0x826b5e),
    water: hex(0xc58a4e),
    sun: hex(0xffe2b0),
    sunPower: 2.6,
    ambient: 1.1,
  },
  neon: {
    sky: hex(0x0d1130),
    groundA: hex(0x262d6a),
    groundB: hex(0x1e2459),
    road: hex(0x0f1230),
    roadEdge: hex(0xff2fb3),
    water: hex(0x0a3fa8),
    sun: hex(0x8fa2ff),
    sunPower: 0.7,
    ambient: 0.72,
  },
};

const mixPalette = (info: BiomeInfo): Palette => {
  const a = PALETTES[info.biome];
  if (info.blend <= 0) return a;
  const b = PALETTES[info.next];
  const t = info.blend;
  const c = (x: THREE.Color, y: THREE.Color) => x.clone().lerp(y, t);
  return {
    sky: c(a.sky, b.sky),
    groundA: c(a.groundA, b.groundA),
    groundB: c(a.groundB, b.groundB),
    road: c(a.road, b.road),
    roadEdge: c(a.roadEdge, b.roadEdge),
    water: c(a.water, b.water),
    sun: c(a.sun, b.sun),
    sunPower: a.sunPower + (b.sunPower - a.sunPower) * t,
    ambient: a.ambient + (b.ambient - a.ambient) * t,
  };
};

/** Materiais de luz que piscam: criados uma vez (criar um por quadro só gera lixo). */
const lit: Record<string, THREE.Material> = {};
const cached = (key: string, make: () => THREE.Material) => (lit[key] ??= make());

/** A altura do chão onde o herói pisa em cada tipo de faixa (tora e pedra ficam acima da água). */
const TOP: Record<Lane['kind'], number> = { descanso: 0.3, estrada: 0.12, trilho: 0.12, rio: 0.22 };

/** Para onde a câmera aponta (o eixo "direita" da tela no mundo), para ancorar o semáforo na borda. */
const RIGHT = { x: 0.843, z: -0.539 };

interface Holder {
  obj: THREE.Object3D;
  item: FlowItem;
}

interface CamInfo {
  x: number;
  row: number;
  /** Meia largura visível da tela (unidades da câmera). */
  halfW: number;
  /** Quantas linhas para trás a tela mostra (as faixas mais longe nem precisam ser atualizadas). */
  reach: number;
}

class LaneView {
  readonly group = new THREE.Group();
  readonly row: number;
  private holders = new Map<number, Holder>();
  private pads = new Map<number, THREE.Object3D>();
  private train: THREE.Object3D | null = null;
  private trainLights: THREE.Mesh[] = [];
  private readonly biome: AtravessaBiome;

  constructor(
    readonly lane: Lane,
    record: number | null,
  ) {
    this.row = lane.row;
    const pal = mixPalette(lane.biome);
    const b = laneBiome(lane.biome);
    this.biome = b;
    this.group.position.z = -lane.row;
    const top = TOP[lane.kind];
    const g = this.group;
    /** O que não mexe (chão, árvores, trilhos) é juntado em poucas malhas no fim. */
    const st = new THREE.Group();

    if (lane.kind === 'descanso') {
      const c = lane.row % 2 === 0 ? pal.groundA : pal.groundB;
      st.add(box(FLOOR_W, 0.3, 1, c, 0, 0.15, 0, { cast: false }));
      for (const col of lane.blocked) {
        const t = buildTree(b, hash2(lane.row, col));
        t.position.set(col, top, 0);
        st.add(t);
      }
      // cenário nas laterais, fora da área de jogo
      for (const side of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const r = hash2(lane.row * 7 + side, i);
          if (r > 0.55) continue;
          const x = side * (ATR_HALF_COLS + 1.6 + i * 1.7 + hash2(i, lane.row) * 0.8);
          const t = buildTree(b, hash2(lane.row + i, side + 3));
          t.position.set(x, top, 0);
          st.add(t);
        }
      }
    } else if (lane.kind === 'estrada' || lane.kind === 'trilho') {
      st.add(box(FLOOR_W, 0.12, 1, lane.kind === 'trilho' ? pal.groundB : pal.road, 0, 0.06, 0, { cast: false }));
      if (lane.kind === 'estrada') {
        st.add(box(FLOOR_W, 0.02, 0.06, pal.roadEdge, 0, 0.13, 0.46, { cast: false, emissive: b === 'neon' ? 0.9 : 0 }));
        st.add(box(FLOOR_W, 0.02, 0.06, pal.roadEdge, 0, 0.13, -0.46, { cast: false, emissive: b === 'neon' ? 0.9 : 0 }));
      } else {
        for (let x = -FLOOR_W / 2; x < FLOOR_W / 2; x += 0.9) st.add(box(0.28, 0.06, 0.78, 0x6b5b4a, x, 0.15, 0, { cast: false }));
        st.add(box(FLOOR_W, 0.05, 0.08, 0xb8bcc8, 0, 0.17, 0.2, { cast: false }));
        st.add(box(FLOOR_W, 0.05, 0.08, 0xb8bcc8, 0, 0.17, -0.2, { cast: false }));
        const tr = buildTrain(ATR_TRAIN_LEN);
        if (lane.dir === -1) tr.rotation.y = Math.PI;
        tr.position.y = top;
        tr.visible = false;
        g.add(tr);
        this.train = tr;
        for (const x of [-(ATR_HALF_COLS + 1.4), ATR_HALF_COLS + 1.4]) {
          const s = buildSignal();
          s.group.position.set(x, 0.12, 0.4);
          g.add(s.group);
          this.trainLights.push(...s.lights);
        }
      }
    } else {
      // rio: o fundo e a água um pouco abaixo da beirada
      st.add(box(FLOOR_W, 0.1, 1, pal.water, 0, -0.05, 0, { cast: false, emissive: b === 'neon' ? 0.3 : 0 }));
      if (lane.pads) {
        for (const p of lane.pads) {
          const pad = buildPad(b, p.sinks, hash2(lane.row, p.col));
          pad.position.set(p.col, 0, 0);
          g.add(pad);
          this.pads.set(p.col, pad);
        }
      }
    }

    // a faixa do recorde tem prioridade sobre o arco do marco (os dois na mesma linha: só o recorde)
    if (record !== null && lane.row === record) {
      g.add(buildGate('recorde', `SEU RECORDE · ${record}`, lane.kind === 'rio' ? 0.1 : top));
    } else if (atravessaMilestone(lane.row)) {
      g.add(buildGate('marco', `${lane.row}`, lane.kind === 'rio' ? 0.1 : top));
    }
    bakeInto(g, st, true);
    // a faixa não mexe: a matriz dela é calculada uma vez
    g.updateMatrix();
    g.matrixAutoUpdate = false;
  }

  /** Solta as geometrias que são só desta faixa (as dos modelos compartilhados ficam). */
  dispose() {
    disposeOwned(this.group);
  }

  private make(item: FlowItem): THREE.Object3D {
    const { lane, biome } = this;
    let obj: THREE.Object3D;
    if (item.kind === 'tora') obj = buildLog(item.len, biome);
    else if (item.kind === 'croc') obj = buildCroc(item.len, biome);
    else if (item.kind === 'tartaruga') obj = buildTurtles(item.len, biome);
    else {
      obj = buildVehicle(item.kind, biome, item.variant);
      obj.position.y = TOP.estrada;
    }
    if (lane.dir === -1) obj.rotation.y = Math.PI;
    this.group.add(obj);
    return obj;
  }

  update(tick: number, sim: AtravessaSim, now: number, cam: CamInfo) {
    // faixas longe da tela não precisam ser atualizadas (voltam a ser quando entram no alcance)
    if (this.row > cam.row + cam.reach + 6 || this.row < cam.row - cam.reach) return;
    const { lane } = this;
    if (lane.flow) {
      const items = laneItems(lane, tick);
      const seen = new Set<number>();
      for (const it of items) {
        seen.add(it.id);
        let h = this.holders.get(it.id);
        if (!h) {
          h = { obj: this.make(it), item: it };
          this.holders.set(it.id, h);
        }
        h.obj.position.x = it.x;
        this.animate(h, tick, now);
      }
      for (const [id, h] of this.holders) {
        if (!seen.has(id)) {
          this.group.remove(h.obj);
          disposeOwned(h.obj);
          this.holders.delete(id);
        }
      }
    }
    if (this.train) {
      const st = trainState(lane, tick);
      this.train.visible = st.x !== null;
      if (st.x !== null) this.train.position.x = st.x;
      // pisca em 4 Hz durante o aviso; fora dele, apagado
      const on = st.warning && Math.floor(now * 4) % 2 === 0;
      this.trainLights.forEach((l, i) => {
        const isLit = st.warning && (i % 2 === 0 ? on : !on);
        l.material = isLit ? cached('trainOn', () => mat(0xff2a2a, 1)) : cached('trainOff', () => mat(0x3a1010));
      });
    }
    if (this.pads.size && sim.row === this.row) {
      const col = Math.round(sim.hx);
      const pad = this.pads.get(col);
      const v = sim.view();
      if (pad && v.sinking > 0 && !v.step) {
        pad.position.y = -0.18 * v.sinking;
        pad.position.x = col + Math.sin(now * 30) * 0.03 * v.sinking;
      }
    }
  }

  /** As partes que mexem de cada coisa: luzes da ambulância, hélices, boca do crocodilo, mergulho. */
  private animate(h: Holder, tick: number, now: number) {
    const { item, obj } = h;
    if (item.kind === 'ambulancia') {
      const lights = obj.userData.lights as THREE.Mesh[];
      const flip = Math.floor(now * 7) % 2 === 0;
      lights[0]!.material = flip ? cached('ambRedOn', () => mat(0xff2a2a, 1.4)) : cached('ambRedOff', () => mat(0x4a1010));
      lights[1]!.material = flip ? cached('ambBlueOff', () => mat(0x10204a)) : cached('ambBlueOn', () => mat(0x2a6aff, 1.4));
    } else if (item.kind === 'drone') {
      for (const p of obj.userData.props as THREE.Object3D[]) p.rotation.y = now * 40;
      obj.position.y = TOP.estrada + Math.sin(now * 3 + item.id) * 0.04;
    } else if (item.kind === 'croc') {
      const jaw = obj.userData.jaw as THREE.Object3D;
      const st = crocState(item, tick);
      // avisa estremecendo e abrindo uma fresta; depois abre bem
      jaw.rotation.z = st === 'open' ? 0.72 : st === 'warn' ? 0.12 + Math.abs(Math.sin(now * 36)) * 0.1 : 0.02;
    } else if (item.kind === 'tartaruga') {
      const st = turtleState(item, tick);
      const shells = obj.userData.shells as THREE.Group[];
      shells.forEach((t, i) => {
        if (st === 'up') {
          t.position.y = Math.sin(now * 1.6 + i + item.id) * 0.02;
          t.rotation.z = 0;
        } else if (st === 'warn') {
          // o casco se inclina e afunda um pouco, tremendo
          t.position.y = -0.1 + Math.sin(now * 34 + i) * 0.03;
          t.rotation.z = Math.sin(now * 20 + i) * 0.22;
        } else {
          t.position.y = -0.42;
          t.rotation.z = 0;
        }
      });
    }
  }
}

/** A raposa é menor que uma casa: ao lado dos carros e das motos ela precisa parecer pequena. */
const HERO_SCALE = 0.82;

/** Quanto o herói e a câmera suavizam (por segundo). */
const CAM_FOLLOW = 5;

/** As cores dos pedacinhos que voam em cada morte. */
const BURST_COLORS: Record<AtravessaEnd, number[]> = {
  veiculo: [0xff8a2a, 0xffd9b0, 0xd8d8d0, 0x3a3a40],
  trem: [0xff8a2a, 0xffd9b0, 0xffd23f, 0xd8d8d0],
  agua: [0xffffff, 0xbfe6ff, 0x58bdf2, 0xffffff],
  arrastado: [0xffffff, 0xbfe6ff, 0x58bdf2],
  afundou: [0xffffff, 0xbfe6ff, 0x58bdf2],
  mordido: [0xff8a2a, 0xffffff, 0xe5303a],
  atingido: [0xff8a2a, 0xffd9b0, 0xc79a3c, 0xffd23f],
  escuridao: [0x2a2540, 0x4a3f7a, 0x14102a],
};

export class AtravessaScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-6, 6, 7, -7, 0.1, 140);
  private sun = new THREE.DirectionalLight(0xffffff, 2.2);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.2);
  /** Na noite o herói leva uma luz pequena e quente: o chão ao redor dele sempre se lê. */
  private heroLight = new THREE.PointLight(0xffe2b0, 0, 7, 1.6);
  private lanes = new Map<number, LaneView>();
  private hero = buildHero();
  private heroBody: THREE.Object3D;
  private heroAngle = 0;
  private camRow = 1;
  private camX = 0;
  private maxRow = 0;
  private aspect = 1;
  private halfW = 6;
  private halfH = 6;
  private reduced: boolean;
  private record: number | null = null;
  /** Qualidade automática: se o aparelho não dá conta, corta primeiro as sombras e depois a resolução. */
  private slowFrames = 0;
  private quality = 2;
  private size = { w: 0, h: 0 };
  private burst = new Burst(20);
  private burstFired = false;
  private sweepFx: {
    id: number;
    line: THREE.Mesh;
    bang: THREE.Sprite;
    ring: THREE.Group;
    hazard: THREE.Group;
    y: number;
  } | null = null;

  constructor(canvas: HTMLCanvasElement, reducedMotion = false) {
    this.reduced = reducedMotion;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    // o pixel ratio é limitado: em tela de alta densidade, o custo de pintar cresce com o quadrado
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = PALETTES.horta.sky.clone();
    this.scene.fog = new THREE.Fog(PALETTES.horta.sky.clone(), 34, 70);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -12;
    sc.right = 12;
    sc.top = 12;
    sc.bottom = -12;
    sc.near = 1;
    sc.far = 60;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target, this.hemi, this.heroLight, this.burst.group);

    this.heroBody = this.hero.getObjectByName('body')!;
    this.scene.add(this.hero);
  }

  /** A linha do recorde (a faixa dourada). Chame antes de começar; `null` = sem recorde ainda. */
  setRecord(rows: number | null) {
    this.record = rows && rows > 0 ? rows : null;
  }

  resize(w: number, h: number) {
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.aspect = w / Math.max(1, h);
    // sempre mostra ~11 casas de largura; em tela larga, no mínimo 5,6 de meia altura
    const halfW0 = 5.6;
    const halfH = Math.max(halfW0 / this.aspect, 5.6);
    const halfW = halfH * this.aspect;
    this.halfW = halfW;
    this.halfH = halfH;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  private ensureLanes(sim: AtravessaSim, centerRow: number) {
    // celular em pé mostra muito mais linhas para cima e para baixo: monta o bastante para o céu não aparecer
    // (antes da largada é grama, para a tela não ficar vazia)
    const behind = Math.max(ROWS_BEHIND, Math.ceil(this.halfH * 1.9));
    const ahead = Math.max(ROWS_AHEAD, Math.ceil(this.halfH * 2.8));
    const lo = Math.floor(centerRow) - behind;
    const hi = Math.floor(centerRow) + ahead;
    for (const [row, lv] of this.lanes) {
      if (row < lo || row > hi) {
        this.scene.remove(lv.group);
        lv.dispose();
        this.lanes.delete(row);
      }
    }
    for (let r = lo; r <= hi; r++) {
      if (this.lanes.has(r)) continue;
      const lv = new LaneView(sim.world.lane(r), this.record);
      this.lanes.set(r, lv);
      this.scene.add(lv.group);
    }
  }

  private applyPose(p: Pose, x: number, y: number, topY: number) {
    this.hero.position.set(x + p.dx, topY + p.lift, -y + p.dz);
    this.heroBody.scale.set(p.sx, p.sy, p.sz);
    this.heroBody.rotation.set(p.pitch, p.ry, p.roll + p.rz);
    this.hero.visible = p.alpha > 0.02;
    this.hero.scale.setScalar(HERO_SCALE * Math.max(0.01, p.alpha));
  }

  /**
   * Se os quadros demoram mais de ~28 ms por 1 s seguido, o aparelho está sofrendo: corta as sombras;
   * se continuar assim, baixa a resolução. Nunca volta atrás (para não ficar alternando).
   */
  private adapt(dt: number) {
    if (dt <= 0 || this.quality === 0) return;
    this.slowFrames = dt > 0.028 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 2);
    if (this.slowFrames < 40) return;
    this.slowFrames = 0;
    this.quality--;
    if (this.quality === 1) {
      this.sun.castShadow = false;
    } else {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(this.size.w, this.size.h, false);
    }
  }

  /** Tira da cena o que a varrida criou. */
  private clearSweep() {
    const fx = this.sweepFx;
    if (!fx) return;
    this.scene.remove(fx.line, fx.bang, fx.ring, fx.hazard);
    fx.line.geometry.dispose();
    this.sweepFx = null;
  }

  /**
   * A varrida (spec 029): uma linha fina desce pela coluna do herói, um "!" desliza por ela e para onde
   * o herói estava, o chão do alvo pulsa; depois o perigo desce pela mesma linha, de frente.
   * Para escapar é só pular para o lado.
   */
  private updateSweep(sw: SweepView | null, now: number) {
    if (!sw) {
      this.clearSweep();
      return;
    }
    if (!this.sweepFx || this.sweepFx.id !== sw.id) {
      this.clearSweep();
      const len = sw.from - sw.row0;
      const line = buildSweepLine(len);
      const bang = buildBang();
      const ring = buildTargetRing();
      const hazard = buildSweepHazard(sw.kind);
      hazard.visible = false;
      hazard.rotation.y = Math.PI / 2; // anda ao longo da coluna: de frente para o herói
      line.position.set(sw.col, 0.46, -(sw.row0 + len / 2));
      this.scene.add(line, bang, ring, hazard);
      this.sweepFx = { id: sw.id, line, bang, ring, hazard, y: 0.3 };
    }
    const fx = this.sweepFx;
    const len = sw.from - sw.row0;
    const laneTop = (row: number) => {
      const l = this.lanes.get(Math.round(row))?.lane;
      return l ? TOP[l.kind] : 0.3;
    };
    const mat3 = fx.line.material as THREE.MeshBasicMaterial;
    const hit = sw.phase === 'hit';

    // a linha aparece depressa e, quando o perigo entra, fica mais discreta
    mat3.opacity = hit ? 0.3 : Math.min(0.9, sw.warn * 7);
    fx.line.position.y = 0.46;

    // o "!" desliza do começo da linha até o alvo (primeiros 70% do aviso) e fica pulsando lá
    const travel = Math.min(1, sw.warn / 0.7);
    const eased = 1 - (1 - travel) * (1 - travel) * (1 - travel);
    const bangRow = sw.from - len * eased;
    const pulse = 1 + Math.sin(now * 11) * 0.1 * (travel >= 1 ? 1 : 0.3);
    fx.bang.position.set(sw.col, laneTop(bangRow) + 1.35 + Math.sin(now * 6) * 0.05, -bangRow);
    fx.bang.scale.setScalar(1.0 * pulse * (hit ? Math.max(0, 1 - 0) : 1));
    fx.bang.visible = !hit || (sw.at !== null && sw.at > sw.row0);
    fx.bang.material.opacity = hit ? 0.55 : Math.min(1, sw.warn * 8);

    // o anel no chão do alvo pisca mais rápido quanto mais perto de o perigo chegar
    fx.ring.position.set(sw.col, laneTop(sw.row0) + 0.06, -sw.row0);
    const ringPulse = 1 + Math.sin(now * (6 + sw.warn * 12)) * 0.07;
    fx.ring.scale.set(ringPulse, 1, ringPulse);
    fx.ring.visible = sw.warn > 0.1 && (!hit || (sw.at !== null && sw.at > sw.row0 - 1));

    // o perigo: desce pela coluna, rolando ou girando conforme o tipo
    if (hit && sw.at !== null) {
      const h = fx.hazard;
      h.visible = true;
      const dist = sw.from - sw.at;
      const ground = laneTop(sw.at);
      fx.y += (ground - fx.y) * 0.35;
      let x = sw.col;
      let lift = 0;
      const spin = h.userData.spin as THREE.Object3D | undefined;
      if (sw.kind === 'barril') {
        lift = Math.abs(Math.sin(dist * 2.6)) * 0.05;
        if (spin) spin.rotation.z = -dist * 1.5;
      } else if (sw.kind === 'feno') {
        // a bola de feno quica enquanto rola
        lift = Math.abs(Math.sin(dist * 1.9)) * 0.38;
        if (spin) spin.rotation.z = -dist * 2.2;
      } else if (sw.kind === 'redemoinho') {
        x += Math.sin(dist * 1.4) * 0.1;
        const layers = h.userData.layers as THREE.Object3D[] | undefined;
        layers?.forEach((l, i) => {
          l.rotation.y = now * (5 + i * 1.5);
          l.position.x = Math.sin(now * 6 + i) * 0.07 * (i + 1);
        });
      }
      h.position.set(x, fx.y + lift, -sw.at);
    } else {
      fx.hazard.visible = false;
    }
  }

  /** Desenha um quadro. `dt` em segundos; `death` quando a partida acabou (age em segundos). */
  render(sim: AtravessaSim, dt: number, now: number, death: { end: AtravessaEnd; age: number } | null) {
    this.adapt(dt);
    const v = sim.view();
    this.maxRow = Math.max(this.maxRow, v.y);

    // a câmera só anda para a frente e acompanha de lado só um pouco
    const k = 1 - Math.exp(-dt * CAM_FOLLOW);
    const targetRow = this.maxRow + 2.6;
    // um salto grande (só acontece ao teletransportar em desenvolvimento) não precisa deslizar
    if (Math.abs(targetRow - this.camRow) > 14) this.camRow = targetRow;
    this.camRow += (targetRow - this.camRow) * (this.reduced ? 1 : k);
    const targetX = Math.max(-1.8, Math.min(1.8, v.x * 0.45));
    this.camX += (targetX - this.camX) * (this.reduced ? 1 : 1 - Math.exp(-dt * 4));

    this.ensureLanes(sim, this.camRow);
    const cam: CamInfo = { x: this.camX, row: this.camRow, halfW: this.halfW, reach: Math.max(16, Math.ceil(this.halfH * 2.4)) };
    for (const lv of this.lanes.values()) lv.update(sim.tick, sim, now, cam);
    this.updateSweep(v.sweep, now);

    // o herói
    // a altura do chão muda de leve entre faixas: acompanha o pulo em vez de saltar de uma vez
    const lo = Math.floor(v.y);
    const frac = v.y - lo;
    const top = TOP[sim.world.lane(lo).kind] * (1 - frac) + TOP[sim.world.lane(lo + 1).kind] * frac;
    this.heroAngle = turnToward(this.heroAngle, HEADING[v.facing] + HERO_LOOK, dt * 22);
    this.hero.rotation.y = this.heroAngle;
    const pose = death ? deathPose(death.end, death.age, v.killer) : heroPose(v, now);
    this.applyPose(pose, v.x, v.y, top);

    // os pedacinhos da morte saem uma vez só, e a câmera dá um tremor curto
    let shakeX = 0;
    let shakeY = 0;
    if (death) {
      if (!this.burstFired) {
        this.burstFired = true;
        const o = new THREE.Vector3(v.x, top + 0.4, -v.y);
        this.burst.fire(o, BURST_COLORS[death.end], v.killer === 0 ? 0 : v.killer, death.end === 'trem' ? 1.4 : 1);
      }
      if (!this.reduced && death.age < 0.35 && death.end !== 'escuridao') {
        const a = Math.sin(death.age * 75) * 0.2 * (1 - death.age / 0.35);
        shakeX = a;
        shakeY = a * 0.6;
      }
    } else {
      this.burstFired = false;
    }
    this.burst.update(dt);

    // luz, céu e névoa seguem o bioma de onde o herói está; a escuridão escurece de dentro para fora
    const info = biomeAt(v.y);
    const pal = mixPalette(info);
    const danger = v.danger;
    const dim = 1 - 0.32 * danger * danger;
    (this.scene.background as THREE.Color).copy(pal.sky).multiplyScalar(1 - 0.3 * danger);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(pal.sky).multiplyScalar(1 - 0.35 * danger);
    fog.near = 34 - 10 * danger;
    this.sun.color.copy(pal.sun);
    this.sun.intensity = pal.sunPower * dim;
    this.hemi.intensity = pal.ambient * dim;
    this.hemi.color.copy(pal.sky).lerp(new THREE.Color(0xffffff), 0.5);
    darkness.uDarkZ.value = -v.darkRow;
    const night = Math.max(0, Math.min(1, (1.25 - pal.ambient) / 0.7));
    this.heroLight.intensity = night * 18 * dim;
    this.heroLight.position.set(v.x, 2.2, -v.y + 0.6);

    // câmera diagonal fixa como no Crossy Road: sai do alvo para trás, para a direita e para cima
    // (as faixas descem da esquerda para a direita e o avanço vai para cima e para a direita)
    const tx = this.camX;
    const tz = -this.camRow;
    this.camera.position.set(tx + 4.6 + shakeX * RIGHT.x, 9.4 + shakeY, tz + 7.2 + shakeX * RIGHT.z);
    this.camera.lookAt(tx, 0, tz);
    this.sun.position.set(tx - 7, 13, tz + 6);
    this.sun.target.position.set(tx, 0, tz);

    const t0 = performance.now();
    this.renderer.render(this.scene, this.camera);
    if (import.meta.env.DEV) {
      const i = this.renderer.info;
      (window as unknown as { __atrPerf?: unknown }).__atrPerf = {
        calls: i.render.calls,
        tris: i.render.triangles,
        geos: i.memory.geometries,
        meshes: this.scene.children.length,
        renderMs: +(performance.now() - t0).toFixed(2),
      };
    }
  }

  dispose() {
    for (const lv of this.lanes.values()) this.scene.remove(lv.group);
    this.lanes.clear();
    this.renderer.dispose();
    disposeModels();
  }
}
