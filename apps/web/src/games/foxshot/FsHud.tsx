import { useEffect, useRef } from 'react';
import { FS_ARENA, FS_TARGETS, type FsGrenadeId, type FsWeaponId } from '@nocap/games';
import { HeartIcon, KillIcon, SkullIcon, VestIcon, WeaponIcon } from './fs-icons';
import { bindLabel, crossHex, fsSettings, useFsSettings } from './fs-settings';

export interface FsPlayerRow {
  id: string;
  name: string;
  you: boolean;
  alive: boolean;
  armor: number;
  kills: number;
  deaths: number;
  assists: number;
  hs: number;
  damage: number;
  /** Pontos da partida (100 por abate, 50 por assistência); só no mata-mata. */
  points?: number;
  /** Time (só a cor): contra-terrorista azul ou terrorista laranja. */
  team?: 'ct' | 't';
  /** Dinheiro (modo Bomba): só vem preenchido para aliados. */
  money?: number;
}

export interface FeedItem {
  key: number;
  killer: string;
  weapon: FsWeaponId | FsGrenadeId;
  victim: string;
  head: boolean;
  /** Fui eu que matei? */
  you: boolean;
  /** Quem deu a assistência (se houve) e se fui eu. */
  assist?: string;
  youAssist?: boolean;
  /** Fui eu que morri? (também fica em destaque, como no CS) */
  youVictim?: boolean;
  /** Efeitos do abate (ícones, como no CS2): o tiro varou parede, foi sem mirar (sniper) e o atirador estava cego. */
  wall?: boolean;
  noscope?: boolean;
  blindKiller?: boolean;
}

import type { FsPlan } from './FsMapPlan';

export interface MinimapData {
  x: number;
  z: number;
  yaw: number;
  targets: { x: number; z: number; alive: boolean; armor: number }[];
  /** Paredes e caixas do mapa (padrão: a arena de teste). */
  boxes?: readonly { min: readonly [number, number, number]; max: readonly [number, number, number] }[];
  /** A planta do mapa desenhada uma vez (substitui as caixas nos mapas grandes). */
  plan?: FsPlan;
  /** Nomes das áreas, para o mapa grande. */
  labels?: readonly { x: number; z: number; text: string }[];
  /** As bombas A e B e as bases terrorista e contra-terrorista (só no Duna), nos dois mapas. */
  marks?: readonly FsMapMark[];
  /** O radar como o do CS: aliados sempre (azul) e inimigos vistos ou escutados (vermelho, sumindo devagar). */
  intel?: readonly FsIntelDot[];
}

export interface FsIntelDot {
  x: number;
  z: number;
  yaw: number;
  kind: 'ally' | 'seen' | 'shot' | 'step';
  alpha: number;
  live: boolean;
  name?: string;
}

/**
 * Pontos do radar: aliado = azul com a direção para onde olha; inimigo visto = vermelho cheio com anel branco; tiro escutado =
 * vermelho com ondas se espalhando enquanto atira; passos escutados = vermelho menor com anel tracejado. Fica no último lugar e some devagar.
 */
function drawIntel(g: CanvasRenderingContext2D, dots: readonly FsIntelDot[], at: (x: number, z: number) => [number, number], big: boolean, rot = 0) {
  const R = big ? 8 : 4.6;
  const t = performance.now() / 1000;
  for (const d of dots) {
    const [x, z] = at(d.x, d.z);
    g.save();
    g.globalAlpha = Math.max(0, Math.min(1, d.alpha));
    g.translate(x, z);
    if (d.kind === 'ally') {
      g.save();
      g.rotate(-(d.yaw * Math.PI) / 180);
      g.beginPath();
      g.moveTo(0, -R * 1.9);
      g.lineTo(R * 0.95, R * 0.3);
      g.lineTo(-R * 0.95, R * 0.3);
      g.closePath();
      g.fillStyle = '#4da3ff';
      g.fill();
      g.restore();
      g.beginPath();
      g.arc(0, 0, R, 0, Math.PI * 2);
      g.fillStyle = '#2f7bff';
      g.fill();
      g.lineWidth = big ? 2.4 : 1.5;
      g.strokeStyle = '#ffffff';
      g.stroke();
      if (big && d.name) {
        g.rotate(rot);
        g.font = '700 13px Rajdhani, system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineWidth = 4;
        g.lineJoin = 'round';
        g.strokeStyle = 'rgba(5,8,20,.95)';
        g.strokeText(d.name, 0, -R - 9);
        g.fillStyle = '#9cc4ff';
        g.fillText(d.name, 0, -R - 9);
      }
    } else {
      if (d.kind === 'shot') {
        // ondas de som enquanto o tiro continua chegando
        for (const k of d.live ? [0, 0.5] : [0]) {
          const p = (t * 1.6 + k) % 1;
          g.beginPath();
          g.arc(0, 0, R + p * R * 3, 0, Math.PI * 2);
          g.lineWidth = big ? 2.4 : 1.4;
          g.strokeStyle = `rgba(255,70,70,${(1 - p) * 0.9})`;
          g.stroke();
        }
      }
      if (d.kind === 'seen') {
        g.save();
        g.rotate(-(d.yaw * Math.PI) / 180);
        g.beginPath();
        g.moveTo(0, -R * 1.9);
        g.lineTo(R * 0.95, R * 0.3);
        g.lineTo(-R * 0.95, R * 0.3);
        g.closePath();
        g.fillStyle = '#ff3b3b';
        g.fill();
        g.restore();
      }
      g.beginPath();
      g.arc(0, 0, d.kind === 'step' ? R * 0.8 : R, 0, Math.PI * 2);
      g.fillStyle = '#ff3030';
      g.fill();
      g.lineWidth = big ? 2.4 : 1.5;
      g.strokeStyle = d.kind === 'step' ? 'rgba(255,255,255,.7)' : '#ffffff';
      if (d.kind === 'step') g.setLineDash([3, 2]);
      g.stroke();
      g.setLineDash([]);
    }
    g.restore();
  }
}

export interface FsMapMark {
  id: 'A' | 'B' | 'T' | 'CT';
  short: string;
  name: string;
  kind: 'site' | 'base';
  x: number;
  z: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

const BASE_COLOR = { CT: '63,130,255', T: '255,122,40' } as const;
const BASE_TEXT = { CT: '#8fbaff', T: '#ffab72' } as const;

/**
 * Desenha as marcações do mapa: as bases como áreas tingidas (azul para a contra-terrorista, laranja para a terrorista) e as
 * bombas como um círculo com a letra. `at` leva metros ao canvas; `k` é pixels por metro; `big` mostra os nomes por extenso;
 * `rot` desfaz a rotação do radar para as letras ficarem em pé.
 */
function drawMarks(g: CanvasRenderingContext2D, marks: readonly FsMapMark[], at: (x: number, z: number) => [number, number], k: number, big: boolean, rot = 0, pass: 'area' | 'text' = 'area') {
  for (const m of marks) {
    const [ax, az] = at(m.x0, m.z0);
    const [bx, bz] = at(m.x1, m.z1);
    const [cx, cz] = at(m.x, m.z);
    if (pass === 'area') {
      if (m.kind === 'base') {
        const col = BASE_COLOR[m.id as 'CT' | 'T'];
        g.fillStyle = `rgba(${col},${big ? 0.2 : 0.28})`;
        g.fillRect(ax, az, bx - ax, bz - az);
        g.strokeStyle = `rgba(${col},0.85)`;
        g.lineWidth = big ? 2 : 1.2;
        g.setLineDash([6, 4]);
        g.strokeRect(ax, az, bx - ax, bz - az);
        g.setLineDash([]);
      } else {
        const r = Math.max(big ? 18 : 8, Math.min(bx - ax, bz - az) * 0.34);
        g.beginPath();
        g.arc(cx, cz, r, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,179,71,.2)';
        g.fill();
        g.lineWidth = big ? 3 : 1.6;
        g.strokeStyle = 'rgba(255,179,71,.95)';
        g.stroke();
      }
      continue;
    }
    // textos por cima de tudo
    g.save();
    g.translate(cx, cz);
    g.rotate(rot);
    g.lineJoin = 'round';
    if (m.kind === 'site') {
      g.font = `900 ${big ? 34 : 15}px "Saira Stencil One", Rajdhani, system-ui, sans-serif`;
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(5,8,20,.95)';
      g.strokeText(m.short, 0, 1);
      g.fillStyle = '#ffd27a';
      g.fillText(m.short, 0, 1);
      if (big) {
        g.font = '700 14px Rajdhani, system-ui, sans-serif';
        g.lineWidth = 4;
        g.strokeText(m.name, 0, 30);
        g.fillText(m.name, 0, 30);
      }
    } else {
      g.font = `800 ${big ? 17 : 11}px Rajdhani, system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(5,8,20,.95)';
      const text = big ? m.name.toUpperCase() : m.short;
      g.strokeText(text, 0, 0);
      g.fillStyle = BASE_TEXT[m.id as 'CT' | 'T'];
      g.fillText(text, 0, 0);
    }
    g.restore();
  }
}

/** Sem limite de tempo (modo Bomba): não mostra relógio. */
export const clock = (s: number) =>
  s > 86_400 ? '' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Faixa de cima, como a do CS: abates à esquerda, os jogadores (vivos ou caídos) no meio, mortes à direita e o tempo embaixo. */
export function FsTopBar({
  players,
  timeLeft,
  kills,
  deaths,
}: {
  players: FsPlayerRow[];
  timeLeft: number;
  kills: number;
  deaths: number;
}) {
  // mata-mata: todos em fila, do que tem mais pontos para o que tem menos, cada um com a pontuação embaixo (como o CS2)
  if (players.some((p) => p.points !== undefined)) {
    const ranked = [...players].sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || b.kills - a.kills || a.deaths - b.deaths);
    return (
      <div className="fsh-top" data-testid="fs-topbar">
        <ul className="fsh-rank" aria-label="Pontuação dos jogadores" data-testid="fs-rank">
          {ranked.map((p) => (
            <li key={p.id} className={`${p.alive ? '' : 'dead'}${p.you ? ' you' : ''}${p.armor > 0 ? ' vest' : ''}${p.team ? ` ${p.team}` : ''}`} data-testid={`fs-rank-${p.id}`}>
              <span className="fsh-rk-av">
                {p.you ? 'EU' : p.name.replace(/\D/g, '') || p.name.slice(0, 2)}
                {!p.alive && <SkullIcon className="fsh-skull" />}
              </span>
              <b className="fsh-rk-pts">{p.points ?? 0}</b>
            </li>
          ))}
        </ul>
        <div className="fsh-time" data-testid="fs-time">
          {clock(Math.max(0, timeLeft))}
        </div>
      </div>
    );
  }
  const slots = Array.from({ length: 10 }, (_, i) => players[i] ?? null);
  return (
    <div className="fsh-top" data-testid="fs-topbar">
      <div className="fsh-top-row">
        <div className="fsh-score">
          <small>ABATES</small>
          <b>{kills}</b>
        </div>
        <ul className="fsh-players" aria-label="Jogadores">
          {slots.map((p, i) => (
            <li
              key={i}
              className={`${p ? (p.alive ? 'on' : 'dead') : 'empty'}${p?.you ? ' you' : ''}${p && p.armor > 0 ? ' vest' : ''}${p?.team ? ` ${p.team}` : ''}`}
            >
              {p ? <span>{p.you ? 'EU' : p.name.replace(/\D/g, '') || p.name.slice(0, 2)}</span> : <span>?</span>}
              {p && !p.alive && <SkullIcon className="fsh-skull" />}
            </li>
          ))}
        </ul>
        <div className="fsh-score">
          <small>MORTES</small>
          <b>{deaths}</b>
        </div>
      </div>
      <div className="fsh-time" data-testid="fs-time">
        {clock(Math.max(0, timeLeft))}
      </div>
    </div>
  );
}

export function FsKillFeed({ items }: { items: FeedItem[] }) {
  return (
    <ul className="fsh-feed" aria-live="polite" data-testid="fs-feed">
      {items.map((f) => (
        <li key={f.key} className={f.you || f.youAssist || f.youVictim ? 'mine' : 'other'} data-testid={f.you || f.youAssist || f.youVictim ? 'fs-feed-mine' : 'fs-feed-other'}>
          {f.blindKiller && <KillIcon id="blind" className="fsh-ki" />}
          <b>{f.killer}</b>
          {f.assist && <span className="fsh-assist"> + {f.assist}</span>}
          <WeaponIcon id={f.weapon} className="fsh-feed-w" />
          {f.noscope && <KillIcon id="noscope" className="fsh-ki" />}
          {f.wall && <KillIcon id="wall" className="fsh-ki" />}
          {f.head && <KillIcon id="head" className="fsh-ki" />}
          <b>{f.victim}</b>
        </li>
      ))}
    </ul>
  );
}

/** Radar redondo: gira com o jogador (a frente é sempre para cima); mostra caixas, alvos e quem tem colete. */
export function FsMinimap({ get }: { get: () => MinimapData }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const size = useFsSettings((st) => st.minimapSize);
  const px = size === 'small' ? 112 : size === 'large' ? 230 : 150;
  useEffect(() => {
    const c = cv.current!;
    const g = c.getContext('2d')!;
    const S = c.width;
    const R = 26; // metros visíveis do centro à borda
    const k = S / 2 / R;
    const draw = () => {
      const d = get();
      g.clearRect(0, 0, S, S);
      g.save();
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = 'rgba(20,24,40,.82)';
      g.fillRect(0, 0, S, S);
      g.translate(S / 2, S / 2);
      const yaw = (d.yaw * Math.PI) / 180;
      // mundo -> radar: yaw positivo gira para a esquerda; a frente fica para cima
      g.rotate(yaw);
      g.translate(-d.x * k, -d.z * k);
      g.fillStyle = 'rgba(190,200,215,.55)';
      if (d.plan) {
        g.imageSmoothingEnabled = true;
        g.drawImage(d.plan.canvas, d.plan.x0 * k, d.plan.z0 * k, d.plan.w * k, d.plan.h * k);
      }
      for (const b of d.plan ? [] : d.boxes ?? FS_ARENA) {
        // mapas grandes: só o que cabe no radar
        if (b.max[0] < d.x - R - 2 || b.min[0] > d.x + R + 2 || b.max[2] < d.z - R - 2 || b.min[2] > d.z + R + 2) continue;
        g.fillRect(
          b.min[0] * k,
          b.min[2] * k,
          (b.max[0] - b.min[0]) * k,
          (b.max[2] - b.min[2]) * k,
        );
      }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (d.marks) drawMarks(g, d.marks, (x, z) => [x * k, z * k], k, false, -yaw, 'area');
      if (d.marks) drawMarks(g, d.marks, (x, z) => [x * k, z * k], k, false, -yaw, 'text');
      if (d.intel) drawIntel(g, d.intel, (x, z) => [x * k, z * k], false, -yaw);
      for (const t of d.targets) {
        if (!t.alive) continue;
        g.beginPath();
        g.arc(t.x * k, t.z * k, 3.4, 0, Math.PI * 2);
        g.fillStyle = '#ff7d26';
        g.fill();
        if (t.armor > 0) {
          g.lineWidth = 1.6;
          g.strokeStyle = '#7fa6ff';
          g.stroke();
        }
      }
      g.restore();
      // você: seta no centro apontando para cima
      g.fillStyle = '#7dff9a';
      g.strokeStyle = '#0b1b10';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(S / 2, S / 2 - 7);
      g.lineTo(S / 2 + 5, S / 2 + 6);
      g.lineTo(S / 2 - 5, S / 2 + 6);
      g.closePath();
      g.fill();
      g.stroke();
    };
    draw();
    const id = window.setInterval(draw, 66);
    return () => window.clearInterval(id);
  }, [get, px]);
  return (
    <canvas
      ref={cv}
      className={`fsh-radar ${size}`}
      width={px}
      height={px}
      data-testid="fs-radar"
      aria-label="Mapa"
    />
  );
}

/** Vida e colete, limpos, no canto de baixo à esquerda. */
export function FsVitals({ hp, armor, helmet }: { hp: number; armor: number; helmet: boolean }) {
  return (
    <div className={`fsh-vitals${hp <= 25 ? ' low' : ''}`} data-testid="fs-bars">
      <div>
        <HeartIcon className="fsh-ic" />
        <b>{hp}</b>
      </div>
      <div className="ar">
        <VestIcon className="fsh-ic" />
        <b>{armor}</b>
        {helmet && (
          <span className="fsh-helm" data-testid="fs-helmet">
            capacete
          </span>
        )}
      </div>
    </div>
  );
}

export interface FsSlotInfo {
  id: FsWeaponId | null;
  name: string;
  /** Tecla do espaço (1, 2, 3). */
  key: number;
}

/**
 * Armas embaixo à direita, no desenho do CS: uma linha por espaço (1 primária, 2 secundária, 3 faca) com o ícone da arma;
 * a que está na mão fica maior, com o nome e a munição em destaque.
 */
export function FsAmmo({
  weapon,
  id,
  ammo,
  mag,
  reloading,
  slots,
  current,
  nades,
  heldNade,
  c4,
}: {
  weapon: string;
  id: FsWeaponId;
  ammo: number;
  mag: number;
  reloading: boolean;
  slots: FsSlotInfo[];
  current: number;
  /** Granadas que tem (com a tecla de cada uma) e a que está na mão. */
  nades: { id: FsGrenadeId; name: string; count: number; key: string }[];
  heldNade: FsGrenadeId | null;
  /** Terrorista com a C4 (modo Bomba): aparece junto das armas, com a tecla de pegar na mão. */
  c4?: { held: boolean } | null;
}) {
  const binds = useFsSettings((st) => st.binds);
  return (
    <div className={`fsh-ammo${ammo === 0 && mag > 0 && !reloading ? ' empty' : ''}`} data-testid="fs-ammo">
      <div className="fsh-ammo-n">
        <b>{mag > 0 ? (reloading ? '...' : ammo) : ''}</b>
        {mag > 0 && <span>/ {mag}</span>}
      </div>
      <ul className="fsh-slots" aria-label="Armas">
        {slots.map((s, i) =>
          s.id ? (
            <li key={s.key} className={i === current && !heldNade && !c4?.held ? 'on' : ''} data-testid={`fs-slot-${s.key}`}>
              <i>{bindLabel(binds[`slot${s.key}` as 'slot1'])}</i>
              <WeaponIcon id={s.id} className="fsh-w" />
              {i === current && !heldNade && !c4?.held && <small>{s.name}</small>}
            </li>
          ) : null,
        )}
        {nades.map((n) => (
          <li key={n.id} className={heldNade === n.id ? 'on' : ''} data-testid={`fs-nade-${n.id}`}>
            <i>{n.key}</i>
            <WeaponIcon id={n.id} className="fsh-w" />
            {heldNade === n.id && <small>{n.name}</small>}
            <em className="fsh-n">x{n.count}</em>
          </li>
        ))}
        {c4 && (
          <li className={c4.held ? 'on' : ''} data-testid="fs-slot-c4">
            <i>{bindLabel(binds.bombSlot)}</i>
            <span className="fs-wi fsh-w" style={{ WebkitMaskImage: `url(${import.meta.env.BASE_URL}icons/foxshot/c4.png)`, maskImage: `url(${import.meta.env.BASE_URL}icons/foxshot/c4.png)` }} aria-hidden="true" data-weapon="c4" />
            {c4.held && <small>C4</small>}
          </li>
        )}
      </ul>
      <span className="fsh-sr">
        {weapon} {id}
      </span>
    </div>
  );
}

export function FsTelemetry({
  fps,
  tris,
  calls,
  level,
  dpr,
  speed,
  ref,
}: {
  fps: number;
  tris: number;
  calls: number;
  level: string;
  dpr: number;
  speed: number;
  ref: string;
}) {
  return (
    <div className="fsh-tele mono" data-testid="fs-perf" aria-label="Desempenho">
      <b className={fps < 30 ? 'bad' : fps < 50 ? 'mid' : ''}>{fps} FPS</b>
      <span data-testid="fs-speed">velocidade {speed.toFixed(1)} m/s</span>
      <span>
        {Math.round(tris / 1000)} mil triângulos · {calls} desenhos
      </span>
      <span>
        qualidade {level === 'high' ? 'alta' : level === 'mid' ? 'média' : 'baixa'} · resolução{' '}
        {dpr}x
      </span>
      {ref && <span>modelos de referência: {ref}</span>}
    </div>
  );
}

/** Mira configurável: cor, tamanho, espessura, vão, ponto e abertura com a dispersão. */
export function FsCrosshair({ spreadPx }: { spreadPx: number }) {
  const s = useFsSettings();
  const gap = s.crossGap + (s.crossDynamic ? spreadPx : 0);
  return (
    <div
      className="fs-cross2"
      aria-hidden="true"
      style={{
        ['--g' as string]: `${gap}px`,
        ['--l' as string]: `${s.crossSize}px`,
        ['--t' as string]: `${s.crossThick}px`,
        ['--c' as string]: crossHex(s),
      }}
    >
      <i />
      <i />
      <i />
      <i />
      {s.crossDot && <b />}
    </div>
  );
}

/** Placar (Tab): todos os jogadores com abates, mortes, % de cabeça e dano, como o do CS. */
export function FsScoreboard({ players, timeLeft, title = 'Treino · Mapa de Treino', bomb }: { players: FsPlayerRow[]; timeLeft: number; title?: string; bomb?: { mySide: 'tr' | 'ct'; tr: number; ct: number } }) {
  const binds = useFsSettings((st) => st.binds);
  const withPts = players.some((p) => p.points !== undefined);
  const rows = [...players].sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || b.kills - a.kills || a.deaths - b.deaths);
  if (bomb) {
    const mine = bomb.mySide === 'tr' ? 't' : 'ct';
    const groups: { key: 't' | 'ct'; label: string; score: number; ally: boolean }[] = [
      { key: mine, label: mine === 't' ? 'Terroristas' : 'Contra-terroristas', score: mine === 't' ? bomb.tr : bomb.ct, ally: true },
      { key: mine === 't' ? 'ct' : 't', label: mine === 't' ? 'Contra-terroristas' : 'Terroristas', score: mine === 't' ? bomb.ct : bomb.tr, ally: false },
    ];
    return (
      <div className="fsh-board" role="dialog" aria-label="Placar" data-testid="fs-board">
        <div className="fsh-board-card">
          <header>
            <span className="mono">{title}</span>
            <b>{clock(Math.max(0, timeLeft))}</b>
          </header>
          {groups.map((g) => {
            const list = rows.filter((p) => p.team === g.key);
            return (
              <section key={g.key} className={`fsh-team ${g.key}${g.ally ? ' ally' : ' foe'}`} data-testid={`fs-team-${g.ally ? 'ally' : 'foe'}`}>
                <h5>
                  <span>{g.label}{g.ally ? ' · seu time' : ''}</span>
                  <b>{g.score}</b>
                </h5>
                <table>
                  <thead>
                    <tr>
                      <th />
                      <th>Jogador</th>
                      <th>{g.ally ? 'Dinheiro' : ''}</th>
                      <th>Abates</th>
                      <th>Assist.</th>
                      <th>Mortes</th>
                      <th>Dano</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.id} className={`${p.you ? 'you' : ''}${p.alive ? '' : ' dead'}`}>
                        <td>
                          <i className={`fsh-av ${g.key}${p.armor > 0 ? ' vest' : ''}`} />
                        </td>
                        <td>
                          {p.name}
                          {p.you ? ' (você)' : ''}
                        </td>
                        <td className="money" data-testid={g.ally ? 'fs-money' : undefined}>{g.ally && p.money !== undefined ? `$${p.money}` : ''}</td>
                        <td>{p.kills}</td>
                        <td>{p.assists}</td>
                        <td>{p.deaths}</td>
                        <td>{p.damage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
          <footer className="mono">Segure {bindLabel(binds.scoreboard)} para ver o placar</footer>
        </div>
      </div>
    );
  }
  return (
    <div className="fsh-board" role="dialog" aria-label="Placar" data-testid="fs-board">
      <div className="fsh-board-card">
        <header>
          <span className="mono">{title}</span>
          <b>{clock(Math.max(0, timeLeft))}</b>
        </header>
        <table>
          <thead>
            <tr>
              <th />
              <th>Jogador</th>
              {withPts && <th>Pontos</th>}
              <th>Abates</th>
              <th>Assist.</th>
              <th>Mortes</th>
              <th>% cabeça</th>
              <th>Dano</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={`${p.you ? 'you' : ''}${p.alive ? '' : ' dead'}`}>
                <td>
                  <i className={`fsh-av${p.armor > 0 ? ' vest' : ''}`} />
                </td>
                <td>
                  {p.name}
                  {p.you ? ' (você)' : ''}
                </td>
                {withPts && <td><b>{p.points}</b></td>}
                <td>{p.kills}</td>
                <td>{p.assists}</td>
                <td>{p.deaths}</td>
                <td>{p.kills > 0 ? Math.round((p.hs / p.kills) * 100) : 0}</td>
                <td>{p.damage}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 10 - rows.length) }, (_, i) => (
              <tr key={`e${i}`} className="empty">
                <td />
                <td>vaga livre</td>
                {withPts && <td>-</td>}
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer className="mono">Segure {bindLabel(binds.scoreboard)} para ver o placar</footer>
      </div>
    </div>
  );
}

export const targetsInfo = FS_TARGETS;

/**
 * Mapa grande (tecla M): o mapa todo visto de cima, com o norte para cima, os nomes das áreas e uma seta onde você está.
 * Não mostra ninguém além de você (no mata-mata os inimigos não aparecem).
 */
export function FsBigMap({ get, title }: { get: () => MinimapData; title: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current!;
    const g = c.getContext('2d')!;
    const draw = () => {
      const d = get();
      const boxes = d.plan ? [] : d.boxes ?? [];
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      if (d.plan) {
        x0 = d.plan.x0;
        x1 = d.plan.x0 + d.plan.w;
        z0 = d.plan.z0;
        z1 = d.plan.z0 + d.plan.h;
      }
      for (const b of boxes) {
        x0 = Math.min(x0, b.min[0]);
        x1 = Math.max(x1, b.max[0]);
        z0 = Math.min(z0, b.min[2]);
        z1 = Math.max(z1, b.max[2]);
      }
      if (!boxes.length && !d.plan) return;
      const W = c.clientWidth;
      const H = c.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const pad = 18;
      const k = Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (z1 - z0));
      const ox = (W - (x1 - x0) * k) / 2 - x0 * k;
      const oz = (H - (z1 - z0) * k) / 2 - z0 * k;
      g.fillStyle = 'rgba(12,18,40,.96)';
      g.fillRect(ox + x0 * k, oz + z0 * k, (x1 - x0) * k, (z1 - z0) * k);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const at = (x: number, z: number): [number, number] => [ox + x * k, oz + z * k];
      if (d.plan) {
        g.imageSmoothingEnabled = true;
        g.drawImage(d.plan.canvas, ox + x0 * k, oz + z0 * k, (x1 - x0) * k, (z1 - z0) * k);
      }
      if (d.marks) drawMarks(g, d.marks, at, k, true, 0, 'area');
      // pisos elevados e vidro primeiro, depois caixotes e as paredes por cima
      const layer = (b: (typeof boxes)[number]) => (b.max[1] <= 1.1 && b.min[1] <= 0.01 && b.max[0] - b.min[0] > 2.5 && b.max[2] - b.min[2] > 2.5 ? 0 : b.max[1] > 2.6 ? 2 : 1);
      for (const pass of [0, 1, 2]) {
        for (const b of boxes) {
          if (layer(b) !== pass) continue;
          g.fillStyle = pass === 0 ? 'rgba(120,160,200,.35)' : pass === 1 ? 'rgba(190,130,70,.85)' : 'rgba(205,213,230,.88)';
          g.fillRect(ox + b.min[0] * k, oz + b.min[2] * k, Math.max(1, (b.max[0] - b.min[0]) * k), Math.max(1, (b.max[2] - b.min[2]) * k));
        }
      }
      g.font = '700 13px Rajdhani, system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const l of d.labels ?? []) {
        const tx = ox + l.x * k;
        const tz = oz + l.z * k;
        g.lineWidth = 4;
        g.strokeStyle = 'rgba(5,8,20,.95)';
        g.strokeText(l.text, tx, tz);
        g.fillStyle = '#ffd27a';
        g.fillText(l.text, tx, tz);
      }
      if (d.marks) drawMarks(g, d.marks, at, k, true, 0, 'text');
      if (d.intel) drawIntel(g, d.intel, at, true, 0);
      // você: seta apontando para onde olha (yaw 0 = norte, positivo vira para a esquerda)
      const px = ox + d.x * k;
      const pz = oz + d.z * k;
      const pulse = 1 + 0.25 * Math.sin(performance.now() / 260);
      g.beginPath();
      g.arc(px, pz, 11 * pulse, 0, Math.PI * 2);
      g.fillStyle = 'rgba(125,255,154,.25)';
      g.fill();
      g.save();
      g.translate(px, pz);
      g.rotate((-d.yaw * Math.PI) / 180);
      g.beginPath();
      g.moveTo(0, -11);
      g.lineTo(7, 8);
      g.lineTo(0, 4);
      g.lineTo(-7, 8);
      g.closePath();
      g.fillStyle = '#7dff9a';
      g.strokeStyle = '#06210f';
      g.lineWidth = 2;
      g.fill();
      g.stroke();
      g.restore();
    };
    draw();
    const id = window.setInterval(draw, 50);
    window.addEventListener('resize', draw);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', draw);
    };
  }, [get]);
  return (
    <div className="fs-bigmap" role="dialog" aria-label="Mapa" data-testid="fs-bigmap">
      <header>
        <b>{title}</b>
        <span className="mono">Você: seta verde · {bindLabelOf('map')} fecha</span>
      </header>
      <canvas ref={cv} />
    </div>
  );
}

const fsSettingsBinds = () => fsSettings().binds;
function bindLabelOf(action: 'map'): string {
  return bindLabel(fsSettingsBinds()[action]);
}
