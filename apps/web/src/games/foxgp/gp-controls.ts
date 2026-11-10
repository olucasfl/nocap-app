import type { GpInput } from '@nocap/games';
import { isTyping } from '@/lib/game-chat-state';

type Key = 'gas' | 'brake' | 'left' | 'right';

const KEYS: Record<string, Key> = {
  KeyW: 'gas',
  ArrowUp: 'gas',
  KeyS: 'brake',
  ArrowDown: 'brake',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/** Quão rápido o volante vai de reto a todo virado (por segundo) com tecla ou botão (que são tudo ou nada). */
const STEER_IN = 5.5;
const STEER_OUT = 8;

/** Aproxima o volante do alvo sem pular (tecla e botão são tudo ou nada). Pura, com teste. */
export function easeSteer(current: number, target: number, dt: number): number {
  const rate = Math.abs(target) > Math.abs(current) && Math.sign(target) === Math.sign(current || target) ? STEER_IN : STEER_OUT;
  const step = rate * dt;
  if (Math.abs(target - current) <= step) return target;
  return current + Math.sign(target - current) * step;
}

/**
 * Entrada do Fox GP: teclado (W/S/A/D, setas, Espaço) e os botões de toque (direção à esquerda; acelerar, frear e turbo à
 * direita). O turbo é um toque: fica guardado até a simulação usar.
 */
export class GpControls {
  private keys: Record<Key, boolean> = { gas: false, brake: false, left: false, right: false };
  private touch: Record<Key, boolean> = { gas: false, brake: false, left: false, right: false };
  private turboQueued = false;
  private steer = 0;
  enabled = true;

  attach() {
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.reset);
  }

  detach() {
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.reset);
  }

  private keyDown = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    const k = KEYS[e.code];
    if (k) {
      this.keys[k] = true;
      e.preventDefault();
    } else if (e.code === 'Space') {
      if (!e.repeat) this.turboQueued = true;
      e.preventDefault();
    }
  };

  private keyUp = (e: KeyboardEvent) => {
    const k = KEYS[e.code];
    if (k) this.keys[k] = false;
  };

  private reset = () => {
    this.keys = { gas: false, brake: false, left: false, right: false };
    this.touch = { gas: false, brake: false, left: false, right: false };
  };

  /** Botão de toque apertado ou solto. */
  press(k: Key, down: boolean) {
    this.touch[k] = down;
  }

  pressTurbo() {
    this.turboQueued = true;
  }

  /** Lê a entrada do quadro (o volante anda suave até o alvo). */
  read(dt: number): GpInput {
    if (!this.enabled) {
      this.steer = 0;
      this.turboQueued = false;
      return { throttle: 0, brake: 0, steer: 0, turbo: false };
    }
    const on = (k: Key) => this.keys[k] || this.touch[k];
    const target = (on('right') ? 1 : 0) - (on('left') ? 1 : 0);
    this.steer = easeSteer(this.steer, target, dt);
    const turbo = this.turboQueued;
    return {
      throttle: on('gas') ? 1 : 0,
      brake: on('brake') ? 1 : 0,
      steer: this.steer,
      turbo,
    };
  }

  /** A simulação usou o turbo (ou a barra não estava cheia): o toque já foi gasto. */
  takeTurbo() {
    this.turboQueued = false;
  }
}
