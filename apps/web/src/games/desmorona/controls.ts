import type { DsmInput } from '@nocap/games';

/** Teclas de movimento: W A S D e setas. A câmera não gira, então "cima" na tela é sempre -Z. */
const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/** Zona morta do joystick (fração do raio): abaixo disso a raposa fica parada. */
export const STICK_DEAD = 0.14;
/** Raio do joystick, em pixels. */
export const STICK_RADIUS = 56;

/**
 * Converte o arrasto do joystick em direção: zona morta, curva suave (pequenos desvios andam devagar, o máximo é 1) e
 * eixos separados (cima na tela = -Z).
 */
export function stickVector(dx: number, dy: number, radius = STICK_RADIUS): { mx: number; mz: number } {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { mx: 0, mz: 0 };
  const mag = Math.min(1, len / radius);
  if (mag < STICK_DEAD) return { mx: 0, mz: 0 };
  const curved = Math.pow((mag - STICK_DEAD) / (1 - STICK_DEAD), 0.85);
  return { mx: (dx / len) * curved, mz: (dy / len) * curved };
}

/**
 * Entrada do jogador: teclado (computador) e joystick flutuante (celular). O joystick nasce onde o polegar toca, na metade
 * esquerda da tela, e o botão de pulo fica à parte (um elemento da tela chama `pressJump`).
 */
export class DsmControls {
  private keys = { up: false, down: false, left: false, right: false };
  private stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  private jumpQueued = false;
  private onStick: ((s: { ox: number; oy: number; x: number; y: number } | null) => void) | null = null;
  private zone: HTMLElement | null = null;

  /** `zone`: onde o polegar do joystick pode tocar; `onStick` avisa a tela para desenhar o joystick. */
  attach(zone: HTMLElement, onStick?: (s: { ox: number; oy: number; x: number; y: number } | null) => void) {
    this.zone = zone;
    this.onStick = onStick ?? null;
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.reset);
    zone.addEventListener('pointerdown', this.down);
    zone.addEventListener('pointermove', this.move);
    zone.addEventListener('pointerup', this.up);
    zone.addEventListener('pointercancel', this.up);
  }

  detach() {
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.reset);
    this.zone?.removeEventListener('pointerdown', this.down);
    this.zone?.removeEventListener('pointermove', this.move);
    this.zone?.removeEventListener('pointerup', this.up);
    this.zone?.removeEventListener('pointercancel', this.up);
    this.zone = null;
  }

  pressJump = () => {
    this.jumpQueued = true;
  };

  private reset = () => {
    this.keys = { up: false, down: false, left: false, right: false };
    this.stick = null;
    this.onStick?.(null);
  };

  private keyDown = (e: KeyboardEvent) => {
    if (e.repeat && e.code !== 'Space') return;
    const k = KEYS[e.code];
    if (k) {
      this.keys[k] = true;
      e.preventDefault();
    } else if (e.code === 'Space') {
      // um toque por pulo: segurar não repete (senão o pulo duplo sairia sozinho)
      if (!e.repeat) this.jumpQueued = true;
      e.preventDefault();
    }
  };

  private keyUp = (e: KeyboardEvent) => {
    const k = KEYS[e.code];
    if (k) this.keys[k] = false;
  };

  private down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || this.stick) return;
    this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
    this.zone?.setPointerCapture(e.pointerId);
    this.onStick?.({ ...this.stick });
  };

  private move = (e: PointerEvent) => {
    if (!this.stick || e.pointerId !== this.stick.id) return;
    this.stick.x = e.clientX;
    this.stick.y = e.clientY;
    this.onStick?.({ ...this.stick });
  };

  private up = (e: PointerEvent) => {
    if (!this.stick || e.pointerId !== this.stick.id) return;
    this.stick = null;
    this.onStick?.(null);
  };

  /** A direção e o pulo de agora (o pulo é "consumido": cada toque vale um pulo). */
  read(): DsmInput {
    let mx = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    let mz = (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0);
    if (this.stick) {
      const v = stickVector(this.stick.x - this.stick.ox, this.stick.y - this.stick.oy);
      if (v.mx !== 0 || v.mz !== 0) {
        mx = v.mx;
        mz = v.mz;
      }
    }
    const jump = this.jumpQueued;
    this.jumpQueued = false;
    return { mx, mz, jump };
  }
}
