import { isTyping } from '@/lib/game-chat-state';
import { stickVector, STICK_RADIUS } from '../desmorona/controls';

/** Graus por pixel do mouse (preso à tela) e por pixel arrastado no celular. */
const MOUSE_DEG = 0.09;
const TOUCH_DEG = 0.2;

export interface FsFrameInput {
  fwd: number;
  strafe: number;
  jump: boolean;
  trigger: boolean;
  ads: boolean;
  reload: boolean;
  /** Arma escolhida por tecla (0 a 2) ou -1; `cycle` troca para a próxima (celular e roda do mouse). */
  pick: number;
  cycle: boolean;
}

/**
 * Entrada do Fox Shot!: computador (WASD, mouse preso à tela, botão esquerdo atira, direito mira, R recarrega, 1 a 3 e roda
 * trocam de arma, Espaço pula) e celular deitado (joystick flutuante à esquerda, arrastar à direita olha, botões na tela).
 */
export class FsControls {
  private keys = new Set<string>();
  private mouse = { left: false, right: false };
  private touchBtn = { fire: false, ads: false, jump: false, reload: false };
  private pickKey = -1;
  private cycleQueued = false;
  private reloadQueued = false;
  private jumpQueued = false;
  private dx = 0;
  private dy = 0;
  private stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  private look: { id: number; x: number; y: number } | null = null;
  private root: HTMLElement | null = null;
  private onStick: ((s: { ox: number; oy: number; x: number; y: number } | null) => void) | null =
    null;
  private onLock: ((locked: boolean) => void) | null = null;
  /** Falso quando um menu está aberto: ignora a entrada. */
  enabled = true;
  readonly touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  attach(root: HTMLElement, onStick?: FsControls['onStick'], onLock?: (locked: boolean) => void) {
    this.root = root;
    this.onStick = onStick ?? null;
    this.onLock = onLock ?? null;
    window.addEventListener('keydown', this.kd);
    window.addEventListener('keyup', this.ku);
    window.addEventListener('blur', this.reset);
    window.addEventListener('wheel', this.wheel, { passive: true });
    document.addEventListener('mousemove', this.mm);
    document.addEventListener('mousedown', this.md);
    document.addEventListener('mouseup', this.mu);
    document.addEventListener('contextmenu', this.ctx);
    document.addEventListener('pointerlockchange', this.plc);
    root.addEventListener('pointerdown', this.pd);
    root.addEventListener('pointermove', this.pm);
    root.addEventListener('pointerup', this.pu);
    root.addEventListener('pointercancel', this.pu);
  }

  detach() {
    window.removeEventListener('keydown', this.kd);
    window.removeEventListener('keyup', this.ku);
    window.removeEventListener('blur', this.reset);
    window.removeEventListener('wheel', this.wheel);
    document.removeEventListener('mousemove', this.mm);
    document.removeEventListener('mousedown', this.md);
    document.removeEventListener('mouseup', this.mu);
    document.removeEventListener('contextmenu', this.ctx);
    document.removeEventListener('pointerlockchange', this.plc);
    const r = this.root;
    if (r) {
      r.removeEventListener('pointerdown', this.pd);
      r.removeEventListener('pointermove', this.pm);
      r.removeEventListener('pointerup', this.pu);
      r.removeEventListener('pointercancel', this.pu);
    }
    if (document.pointerLockElement) document.exitPointerLock();
    this.root = null;
  }

  get locked(): boolean {
    return !!document.pointerLockElement;
  }

  requestLock() {
    if (this.touch || !this.root || this.locked) return;
    try {
      void (this.root.requestPointerLock() as unknown as Promise<void> | undefined)?.catch?.(
        () => undefined,
      );
    } catch {
      /* sem permissão: o próximo clique tenta de novo */
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  setTouch(name: keyof FsControls['touchBtn'] | 'cycle', down: boolean) {
    if (name === 'cycle') {
      if (down) this.cycleQueued = true;
      return;
    }
    if (name === 'reload') {
      if (down) this.reloadQueued = true;
      return;
    }
    if (name === 'jump') {
      if (down) this.jumpQueued = true;
      return;
    }
    this.touchBtn[name] = down;
  }

  /** Giro acumulado desde a última leitura, em graus (yaw para a esquerda positivo, pitch para cima positivo). */
  takeLook(adsScale = 1): { yaw: number; pitch: number } {
    const k = (this.touch ? TOUCH_DEG : MOUSE_DEG) * adsScale;
    const out = { yaw: -this.dx * k, pitch: -this.dy * k };
    this.dx = 0;
    this.dy = 0;
    return out;
  }

  read(): FsFrameInput {
    const k = this.keys;
    let fwd =
      (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let strafe =
      (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) -
      (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    if (this.stick) {
      const v = stickVector(
        this.stick.x - this.stick.ox,
        this.stick.y - this.stick.oy,
        STICK_RADIUS,
      );
      fwd += -v.mz;
      strafe += v.mx;
    }
    fwd = Math.max(-1, Math.min(1, fwd));
    strafe = Math.max(-1, Math.min(1, strafe));
    const jump = this.jumpQueued || k.has('Space');
    this.jumpQueued = false;
    const reload = this.reloadQueued || k.has('KeyR');
    this.reloadQueued = false;
    const cycle = this.cycleQueued;
    this.cycleQueued = false;
    const pick = this.pickKey;
    this.pickKey = -1;
    const on = this.enabled;
    return {
      fwd: on ? fwd : 0,
      strafe: on ? strafe : 0,
      jump: on && jump,
      trigger: on && (this.mouse.left || this.touchBtn.fire),
      ads: on && (this.mouse.right || this.touchBtn.ads),
      reload: on && reload,
      pick: on ? pick : -1,
      cycle: on && cycle,
    };
  }

  private reset = () => {
    this.keys.clear();
    this.mouse.left = this.mouse.right = false;
    this.touchBtn = { fire: false, ads: false, jump: false, reload: false };
    this.stick = null;
    this.look = null;
    this.onStick?.(null);
  };

  private kd = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
    if (e.code === 'Digit1') this.pickKey = 0;
    else if (e.code === 'Digit2') this.pickKey = 1;
    else if (e.code === 'Digit3') this.pickKey = 2;
    else if (e.code === 'KeyQ') this.cycleQueued = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
      e.preventDefault();
    this.keys.add(e.code);
  };
  private ku = (e: KeyboardEvent) => this.keys.delete(e.code);
  private wheel = (e: WheelEvent) => {
    if (this.enabled && this.locked && Math.abs(e.deltaY) > 4) this.cycleQueued = true;
  };
  private mm = (e: MouseEvent) => {
    if (!this.locked || !this.enabled) return;
    this.dx += e.movementX;
    this.dy += e.movementY;
  };
  private md = (e: MouseEvent) => {
    if (this.touch || !this.enabled) return;
    if (!this.locked) {
      // o primeiro clique só prende o mouse (não atira sem querer)
      if (
        e.target instanceof HTMLElement &&
        this.root?.contains(e.target) &&
        !e.target.closest('button')
      )
        this.requestLock();
      return;
    }
    if (e.button === 0) this.mouse.left = true;
    if (e.button === 2) this.mouse.right = true;
  };
  private mu = (e: MouseEvent) => {
    if (e.button === 0) this.mouse.left = false;
    if (e.button === 2) this.mouse.right = false;
  };
  private ctx = (e: Event) => {
    if (this.root && e.target instanceof Node && this.root.contains(e.target)) e.preventDefault();
  };
  private plc = () => {
    if (!this.locked) {
      this.mouse.left = this.mouse.right = false;
    }
    this.onLock?.(this.locked);
  };

  // ---- toque: joystick flutuante à esquerda, olhar à direita
  private pd = (e: PointerEvent) => {
    if (!this.touch || !this.enabled || e.pointerType === 'mouse') return;
    if (e.target instanceof HTMLElement && e.target.closest('button')) return;
    const half = (this.root?.clientWidth ?? window.innerWidth) / 2;
    if (e.clientX < half) {
      if (this.stick) return;
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      this.onStick?.(this.stick);
    } else if (!this.look) {
      this.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
    try {
      this.root?.setPointerCapture(e.pointerId);
    } catch {
      /* sem captura: vale do mesmo jeito */
    }
  };
  private pm = (e: PointerEvent) => {
    if (this.stick && e.pointerId === this.stick.id) {
      this.stick.x = e.clientX;
      this.stick.y = e.clientY;
      this.onStick?.(this.stick);
    } else if (this.look && e.pointerId === this.look.id) {
      this.dx += e.clientX - this.look.x;
      this.dy += e.clientY - this.look.y;
      this.look.x = e.clientX;
      this.look.y = e.clientY;
    }
  };
  private pu = (e: PointerEvent) => {
    if (this.stick && e.pointerId === this.stick.id) {
      this.stick = null;
      this.onStick?.(null);
    }
    if (this.look && e.pointerId === this.look.id) this.look = null;
  };
}
