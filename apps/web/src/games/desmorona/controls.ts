import type { DsmInput } from '@nocap/games';
import { isTyping } from '@/lib/game-chat-state';

/** Teclas de movimento: W A S D e setas ("cima" é para onde a câmera olha). */
/** Q e E giram a câmera (no computador, além de arrastar o mouse). */
const TURN_RATE = 2.2;
/** Radianos de giro por pixel arrastado. */
const DRAG_YAW = 0.0055;

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
export function stickVector(
  dx: number,
  dy: number,
  radius = STICK_RADIUS,
): { mx: number; mz: number } {
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
  private onStick: ((s: { ox: number; oy: number; x: number; y: number } | null) => void) | null =
    null;
  private zone: HTMLElement | null = null;
  private look: HTMLElement | null = null;
  private lookPtr: { id: number; x: number; y: number } | null = null;
  /** Falso depois da queda ou do fim: aí a pessoa precisa do cursor para os botões. */
  allowLock = true;
  /** Q e E giram a câmera; um jogo que usa essas teclas para outra coisa desliga. */
  turnKeys = true;
  /** A pessoa soltou o mouse com Esc: não prende de novo sozinho, só com um clique. */
  private escaped = false;
  private yawAcc = 0;
  private pitchAcc = 0;
  private onLock: ((locked: boolean) => void) | null = null;
  private turn = 0;

  /** `zone`: onde o polegar do joystick pode tocar; `onStick` avisa a tela para desenhar o joystick. */
  attach(
    zone: HTMLElement,
    onStick?: (s: { ox: number; oy: number; x: number; y: number } | null) => void,
  ) {
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

  /**
   * Girar a câmera arrastando: o mouse arrasta em qualquer lugar da tela; no celular o dedo arrasta na metade direita
   * (a esquerda é do joystick). Botões não giram.
   */
  attachLook(el: HTMLElement, onLock?: (locked: boolean) => void) {
    this.look = el;
    this.onLock = onLock ?? null;
    document.addEventListener('mousemove', this.lockedMove);
    document.addEventListener('pointerlockchange', this.lockChange);
    el.addEventListener('pointerdown', this.lookDown);
    el.addEventListener('pointermove', this.lookMove);
    el.addEventListener('pointerup', this.lookUp);
    el.addEventListener('pointercancel', this.lookUp);
  }

  /** Quanto a câmera girou desde a última chamada (rad), somando arrasto e as teclas Q e E. */
  takeYaw(dt: number): number {
    const d = this.yawAcc + this.turn * TURN_RATE * dt;
    this.yawAcc = 0;
    return d;
  }

  /** Quanto a câmera subiu ou desceu desde a última chamada (rad), pelo mouse ou pelo dedo. */
  takePitch(): number {
    const d = this.pitchAcc;
    this.pitchAcc = 0;
    return d;
  }

  /** Com o ponteiro preso à tela, o mouse gira a câmera sem precisar clicar nem arrastar (como nos jogos). */
  private lockedMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.look) return;
    // alguns navegadores mandam um movimento gigante isolado com o ponteiro preso: é defeito, não mão (um giro real nunca passa disso num evento)
    if (Math.abs(e.movementX) > 120 || Math.abs(e.movementY) > 120) return;
    this.yawAcc -= e.movementX * DRAG_YAW * 0.8;
    this.pitchAcc += e.movementY * DRAG_YAW * 0.6;
  };

  private lockChange = () => {
    const locked = document.pointerLockElement === this.look;
    if (!locked && this.allowLock) this.escaped = true;
    if (locked) this.escaped = false;
    this.onLock?.(locked);
  };

  /** Devolve o mouse (fim da partida, queda, saída): sem isso a pessoa não consegue clicar nos botões. */
  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /**
   * Volta a prender o mouse depois de um painel (o chat). O navegador não conta o Esc como gesto da pessoa, então se o
   * pedido agora falhar a próxima tecla ou clique prende (o jogo deixa de achar que a pessoa soltou de propósito).
   */
  resumeLock() {
    this.escaped = false;
    this.requestLock();
  }

  /** Prende o ponteiro (precisa de um clique ou toque da pessoa). Esc solta. */
  requestLock() {
    if (!this.allowLock) return;
    try {
      void (this.look?.requestPointerLock() as Promise<void> | undefined)?.catch?.(() => undefined);
    } catch {
      /* navegador sem suporte: o arrasto continua valendo */
    }
  }

  private lookDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.pointerType === 'mouse' && document.pointerLockElement !== this.look) this.requestLock();
    const rect = this.look?.getBoundingClientRect();
    if (!rect) return;
    // no toque, a metade esquerda é do joystick
    if (e.pointerType !== 'mouse' && e.clientX - rect.left < rect.width * 0.55) return;
    if (this.lookPtr) return;
    this.lookPtr = { id: e.pointerId, x: e.clientX, y: e.clientY };
    this.look?.setPointerCapture(e.pointerId);
  };

  private lookMove = (e: PointerEvent) => {
    if (!this.lookPtr || e.pointerId !== this.lookPtr.id) return;
    this.yawAcc -= (e.clientX - this.lookPtr.x) * DRAG_YAW;
    this.pitchAcc += (e.clientY - this.lookPtr.y) * DRAG_YAW * 0.6;
    this.lookPtr.x = e.clientX;
    this.lookPtr.y = e.clientY;
  };

  private lookUp = (e: PointerEvent) => {
    if (this.lookPtr && e.pointerId === this.lookPtr.id) this.lookPtr = null;
  };

  detach() {
    document.removeEventListener('mousemove', this.lockedMove);
    document.removeEventListener('pointerlockchange', this.lockChange);
    this.releaseLock();
    this.look?.removeEventListener('pointerdown', this.lookDown);
    this.look?.removeEventListener('pointermove', this.lookMove);
    this.look?.removeEventListener('pointerup', this.lookUp);
    this.look?.removeEventListener('pointercancel', this.lookUp);
    this.look = null;
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
    this.turn = 0;
    this.lookPtr = null;
    this.stick = null;
    this.onStick?.(null);
  };

  private keyDown = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    if (e.repeat && e.code !== 'Space') return;
    // a primeira tecla (que conta como gesto da pessoa) já prende o mouse, sem precisar clicar
    if (
      !this.escaped &&
      e.code !== 'Escape' &&
      document.pointerLockElement !== this.look &&
      this.look
    )
      this.requestLock();
    const k = KEYS[e.code];
    if (this.turnKeys && e.code === 'KeyQ') this.turn = -1;
    else if (this.turnKeys && e.code === 'KeyE') this.turn = 1;
    else if (k) {
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
    if (e.code === 'KeyQ' || e.code === 'KeyE') this.turn = 0;
    else if (k) this.keys[k] = false;
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
