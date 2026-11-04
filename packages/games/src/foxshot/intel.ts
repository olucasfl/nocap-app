import { fsClearLine } from './grenades';
import { FS_HEAR_RANGE, type FsWeaponId } from './weapons';
import type { FsBox } from './map';

/**
 * O radar como o do CS (spec 057): os aliados aparecem sempre; os inimigos só quando a pessoa (ou um aliado) os VÊ, quando ela ESCUTA
 * um tiro deles ou ESCUTA os passos deles. Enquanto o sinal continua chegando, o ponto vermelho vai se atualizando; quando para, o ponto
 * fica onde estava e some devagar. Lógica pura (sem tela): o desenho fica no web.
 */

/** Quanto tempo (s) o ponto de cada tipo leva para sumir depois do último sinal. */
export const FS_INTEL_FADE = { seen: 2.2, shot: 4.5, step: 3.2 } as const;
/** Até onde se vê um inimigo (m) e o campo de visão de quem olha (graus, de ponta a ponta). */
export const FS_INTEL_SEE = { range: 70, allyRange: 55, fov: 118 } as const;
/** Até onde se escutam passos fortes (m). */
export const FS_INTEL_STEP_RANGE = 20;

/**
 * O mata-mata de hoje é de todos contra todos: as cores azul e laranja são só enfeite e NÃO há aliados (sem nome em cima da cabeça, sem
 * silhueta por trás da parede, sem pontos azuis no radar). Quando houver um modo com times, é só ligar aqui.
 */
export const FS_TEAMS_ACTIVE = false;

export type FsIntelKind = 'seen' | 'shot' | 'step';

export interface FsIntelPlayer {
  id: string;
  x: number;
  y: number;
  z: number;
  /** Para onde olha (graus, o mesmo yaw do jogo). */
  yaw: number;
  alive: boolean;
  /** 0 contra-terrorista, 1 terrorista. */
  team: 0 | 1;
  /** Está andando de um jeito que faz barulho (corre em pé; devagar e agachado não fazem). */
  loud: boolean;
}

export interface FsIntelMark {
  id: string;
  x: number;
  z: number;
  yaw: number;
  kind: FsIntelKind;
  /** 0 a 1: 1 enquanto está sendo atualizado, caindo até 0. */
  alpha: number;
  /** Ainda chegando sinal agora (o ponto está se mexendo). */
  live: boolean;
}

interface Mark {
  x: number;
  z: number;
  yaw: number;
  kind: FsIntelKind;
  t: number;
}

const D2R = Math.PI / 180;

export class FsIntel {
  private marks = new Map<string, Mark>();

  /** Escutei um tiro: o atirador inimigo aparece onde está se estiver ao alcance do som daquela arma. */
  hearShot(id: string, x: number, z: number, weapon: FsWeaponId, meX: number, meZ: number, now: number, yaw = 0): void {
    if (Math.hypot(x - meX, z - meZ) > FS_HEAR_RANGE[weapon]) return;
    this.marks.set(id, { x, z, yaw, kind: 'shot', t: now });
  }

  /** Um quadro: aliados à parte; para cada inimigo, vê (eu ou um aliado) ou escuta os passos. Só atualiza quem tem sinal agora. */
  step(
    now: number,
    me: { x: number; y: number; z: number; yaw: number; eye: number; team: 0 | 1 },
    others: readonly FsIntelPlayer[],
    boxes: readonly FsBox[],
    teams = FS_TEAMS_ACTIVE,
  ): void {
    const allies = teams ? others.filter((o) => o.team === me.team && o.alive) : [];
    for (const o of others) {
      if (!o.alive) {
        this.marks.delete(o.id);
        continue;
      }
      if (teams && o.team === me.team) {
        this.marks.delete(o.id);
        continue;
      }
      const chest: [number, number, number] = [o.x, o.y + 0.9, o.z];
      let seen = false;
      // eu vejo: na frente (campo de visão), ao alcance e sem parede no meio
      const dx = o.x - me.x;
      const dz = o.z - me.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= FS_INTEL_SEE.range) {
        const ang = Math.atan2(-dx, -dz) / D2R;
        let d = ang - me.yaw;
        while (d > 180) d -= 360;
        while (d < -180) d += 360;
        if (Math.abs(d) <= FS_INTEL_SEE.fov / 2 && fsClearLine(boxes, [me.x, me.eye, me.z], chest)) seen = true;
      }
      // um aliado vê (a visão é dividida, como no CS): sem campo de visão, só alcance e linha limpa
      if (!seen) {
        for (const a of allies) {
          if (Math.hypot(o.x - a.x, o.z - a.z) > FS_INTEL_SEE.allyRange) continue;
          if (fsClearLine(boxes, [a.x, a.y + 1.05, a.z], chest)) {
            seen = true;
            break;
          }
        }
      }
      if (seen) {
        this.marks.set(o.id, { x: o.x, z: o.z, yaw: o.yaw, kind: 'seen', t: now });
      } else if (o.loud && dist <= FS_INTEL_STEP_RANGE) {
        // passos fortes: escuto onde ele está
        const prev = this.marks.get(o.id);
        this.marks.set(o.id, { x: o.x, z: o.z, yaw: o.yaw, kind: prev && prev.kind === 'shot' && now - prev.t < 0.4 ? 'shot' : 'step', t: now });
      }
    }
  }

  /** Os pontos de agora (já com a transparência): some devagar depois do último sinal. */
  view(now: number): FsIntelMark[] {
    const out: FsIntelMark[] = [];
    for (const [id, m] of this.marks) {
      const age = now - m.t;
      const fade = FS_INTEL_FADE[m.kind];
      if (age >= fade) {
        this.marks.delete(id);
        continue;
      }
      const live = age < 0.3;
      out.push({ id, x: m.x, z: m.z, yaw: m.yaw, kind: m.kind, alpha: live ? 1 : Math.max(0, 1 - (age - 0.3) / (fade - 0.3)), live });
    }
    return out;
  }

  clear(): void {
    this.marks.clear();
  }
}
