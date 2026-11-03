import { fsFire, fsGunTick, fsNewGunState, type FsGunState, type FsMoveState, type FsShot } from './recoil';
import { FS_WEAPONS, type FsWeapon, type FsWeaponId } from './weapons';

export type FsGunEvent =
  | { type: 'fire'; shot: FsShot; weapon: FsWeapon }
  | { type: 'dry'; weapon: FsWeapon }
  | { type: 'reload'; weapon: FsWeapon }
  | { type: 'reloaded'; weapon: FsWeapon }
  | { type: 'draw'; weapon: FsWeapon }
  | { type: 'bolt'; weapon: FsWeapon };

interface Slot {
  id: FsWeaponId;
  ammo: number;
  gun: FsGunState;
}

/**
 * A arma na mão do jogador: munição, recarga, troca, cadência e ferrolho. `update` recebe o que a pessoa está fazendo e devolve
 * os eventos desse instante (o jogo toca som e animação a partir deles; o servidor confere o mesmo).
 */
export class FsLoadout {
  readonly slots: Slot[];
  current = 0;
  /** Segundos que faltam para a arma estar pronta (sacando) / recarregando / entre tiros. */
  drawT = 0;
  reloadT = 0;
  cooldown = 0;
  private triggerWas = false;

  constructor(ids: FsWeaponId[] = ['ak', 'pistol', 'sniper']) {
    this.slots = ids.map((id) => ({ id, ammo: FS_WEAPONS[id].mag, gun: fsNewGunState() }));
  }

  get slot(): Slot {
    return this.slots[this.current]!;
  }
  get weapon(): FsWeapon {
    return FS_WEAPONS[this.slot.id];
  }
  get reloading(): boolean {
    return this.reloadT > 0;
  }
  get ready(): boolean {
    return this.drawT <= 0 && this.reloadT <= 0 && this.cooldown <= 0;
  }

  switchTo(index: number): FsGunEvent[] {
    if (index === this.current || index < 0 || index >= this.slots.length) return [];
    this.current = index;
    this.reloadT = 0;
    this.drawT = this.weapon.draw;
    this.cooldown = 0;
    this.triggerWas = false;
    return [{ type: 'draw', weapon: this.weapon }];
  }

  update(dt: number, input: { trigger: boolean; reload: boolean }, move: FsMoveState, playerId: string): FsGunEvent[] {
    const ev: FsGunEvent[] = [];
    const w = this.weapon;
    const s = this.slot;
    fsGunTick(w, s.gun, dt);
    if (this.drawT > 0) this.drawT = Math.max(0, this.drawT - dt);
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.reloadT = 0;
        s.ammo = w.mag;
        ev.push({ type: 'reloaded', weapon: w });
      }
      this.triggerWas = input.trigger;
      return ev;
    }
    if (input.reload && s.ammo < w.mag && this.drawT <= 0) {
      this.reloadT = w.reload;
      ev.push({ type: 'reload', weapon: w });
      this.triggerWas = input.trigger;
      return ev;
    }
    const pressed = input.trigger && !this.triggerWas;
    this.triggerWas = input.trigger;
    const want = w.auto ? input.trigger : pressed;
    if (want && this.drawT <= 0 && this.cooldown <= 0) {
      if (s.ammo <= 0) {
        if (pressed) {
          ev.push({ type: 'dry', weapon: w });
          this.reloadT = w.reload;
          ev.push({ type: 'reload', weapon: w });
        }
        return ev;
      }
      s.ammo--;
      this.cooldown = Math.max(60 / w.rpm, w.boltS);
      ev.push({ type: 'fire', shot: fsFire(w, s.gun, move, playerId), weapon: w });
      if (w.boltS > 0) ev.push({ type: 'bolt', weapon: w });
    }
    return ev;
  }
}
