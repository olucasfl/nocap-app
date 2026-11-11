import type { GpInput } from '@nocap/games';
import { isTyping } from '@/lib/game-chat-state';
import { gpActionOf } from './gp-settings';

type Key = 'gas' | 'brake' | 'left' | 'right' | 'drs';

/** Quão rápido o volante vai de reto a todo virado (por segundo) com tecla ou botão (que são tudo ou nada). */
const STEER_IN = 5.5;
const STEER_OUT = 8;

/** Aproxima o volante do alvo sem pular (tecla e botão são tudo ou nada). Pura, com teste. */
export function easeSteer(current: number, target: number, dt: number): number {
  const rate =
    Math.abs(target) > Math.abs(current) && Math.sign(target) === Math.sign(current || target)
      ? STEER_IN
      : STEER_OUT;
  const step = rate * dt;
  if (Math.abs(target - current) <= step) return target;
  return current + Math.sign(target - current) * step;
}

const none = (): Record<Key, boolean> => ({
  gas: false,
  brake: false,
  left: false,
  right: false,
  drs: false,
});

/**
 * Entrada do Fox GP: teclado pelo mapa do menu Comandos (`gp-settings.ts`, lido a cada tecla) e os botões de toque
 * (direção à esquerda; acelerar, frear e DRS à direita). Um toque no DRS fica guardado até a simulação ler (um toque
 * mais curto que um quadro não se perde).
 */
export class GpControls {
  private keys = none();
  private touch = none();
  private drsQueued = false;
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
    const a = gpActionOf(e.code);
    if (a === 'gas' || a === 'brake' || a === 'left' || a === 'right' || a === 'drs') {
      this.keys[a] = true;
      if (a === 'drs') this.drsQueued = true;
      e.preventDefault();
    }
  };

  private keyUp = (e: KeyboardEvent) => {
    const a = gpActionOf(e.code);
    if (a === 'gas' || a === 'brake' || a === 'left' || a === 'right' || a === 'drs')
      this.keys[a] = false;
  };

  /** A janela perdeu o foco: solta tudo. */
  private reset = () => {
    this.keys = none();
    this.touch = none();
    this.drsQueued = false;
  };

  /** Botão de toque apertado ou solto. */
  press(k: Key, down: boolean) {
    this.touch[k] = down;
    if (k === 'drs' && down) this.drsQueued = true;
  }

  /** Lê a entrada do quadro (o volante anda suave até o alvo). */
  read(dt: number): GpInput {
    if (!this.enabled) {
      this.steer = 0;
      this.drsQueued = false;
      return { throttle: 0, brake: 0, steer: 0 };
    }
    const on = (k: Key) => this.keys[k] || this.touch[k];
    const target = (on('right') ? 1 : 0) - (on('left') ? 1 : 0);
    this.steer = easeSteer(this.steer, target, dt);
    const drs = on('drs') || this.drsQueued;
    this.drsQueued = false;
    return {
      throttle: on('gas') ? 1 : 0,
      brake: on('brake') ? 1 : 0,
      steer: this.steer,
      drs,
    };
  }

  /** O quadro não teve passo da simulação: o toque do DRS continua guardado para o próximo. */
  keepDrs() {
    this.drsQueued = true;
  }

  /** Só o acelerador (para o giro do motor nas luzes, antes de o carro poder andar). */
  throttle(): number {
    return this.enabled && (this.keys.gas || this.touch.gas) ? 1 : 0;
  }
}
