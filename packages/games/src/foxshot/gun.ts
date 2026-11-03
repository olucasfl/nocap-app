import { fsFire, fsGunTick, fsNewGunState, type FsGunState, type FsMoveState, type FsShot } from './recoil';
import { FS_SLOT_ORDER, FS_WEAPONS, type FsSlot, type FsWeapon, type FsWeaponId } from './weapons';

export type FsGunEvent =
  | { type: 'fire'; shot: FsShot; weapon: FsWeapon }
  | { type: 'melee'; kind: 'slash' | 'stab'; weapon: FsWeapon }
  | { type: 'dry'; weapon: FsWeapon }
  | { type: 'reload'; weapon: FsWeapon }
  | { type: 'reloaded'; weapon: FsWeapon }
  | { type: 'draw'; weapon: FsWeapon }
  | { type: 'inspect'; weapon: FsWeapon }
  | { type: 'bolt'; weapon: FsWeapon };

interface Slot {
  id: FsWeaponId;
  ammo: number;
  gun: FsGunState;
}

export interface FsGunInput {
  trigger: boolean;
  reload: boolean;
  /** Botão de mirar: na faca é a estocada. */
  alt?: boolean;
  inspect?: boolean;
}

/**
 * As armas do jogador: três espaços fixos (1 primária, 2 secundária, 3 faca; a faca nunca sai). Cuida de munição, recarga, troca,
 * cadência, ferrolho, corpo a corpo e inspeção. `update` devolve os eventos do instante (o jogo toca som e animação).
 */
export class FsLoadout {
  /** Índice 0 primária, 1 secundária, 2 faca; `null` = espaço vazio. */
  readonly slots: (Slot | null)[];
  current = 0;
  drawT = 0;
  reloadT = 0;
  cooldown = 0;
  inspectT = 0;
  private triggerWas = false;
  /** Clique dado um instante antes de a arma poder atirar: dispara assim que puder (até 0,3 s). */
  private buffered = 0;
  /** Depois do clique de arma vazia, a recarga começa em instantes (dá para ouvir o clique antes do som de tirar o carregador). */
  private dryPending = 0;
  private altWas = false;

  constructor(primary: FsWeaponId | null = 'ak', secondary: FsWeaponId | null = 'pistol') {
    const mk = (id: FsWeaponId | null): Slot | null => (id ? { id, ammo: FS_WEAPONS[id].mag, gun: fsNewGunState() } : null);
    this.slots = [mk(primary), mk(secondary), mk('knife')];
    this.current = primary ? 0 : secondary ? 1 : 2;
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
  get inspecting(): boolean {
    return this.inspectT > 0;
  }

  /** Qual espaço (0 a 2) uma arma ocupa. */
  static slotIndex(slot: FsSlot): number {
    return FS_SLOT_ORDER.indexOf(slot);
  }

  switchTo(index: number): FsGunEvent[] {
    if (index === this.current || index < 0 || index >= this.slots.length || !this.slots[index]) return [];
    this.current = index;
    this.reloadT = 0;
    this.inspectT = 0;
    this.drawT = this.weapon.draw;
    this.cooldown = 0;
    this.triggerWas = false;
    return [{ type: 'draw', weapon: this.weapon }];
  }

  /** Põe uma arma no espaço dela (comprou ou pegou do chão). Devolve a que estava lá (para cair no chão) ou null. */
  equip(id: FsWeaponId, ammo?: number): FsWeaponId | null {
    const w = FS_WEAPONS[id];
    const i = FsLoadout.slotIndex(w.slot);
    const old = this.slots[i];
    if (w.slot === 'knife') return null;
    this.slots[i] = { id, ammo: ammo ?? w.mag, gun: fsNewGunState() };
    // a arma nova vai para a mão
    this.current = i;
    this.reloadT = 0;
    this.inspectT = 0;
    this.drawT = w.draw;
    this.cooldown = 0;
    return old && old.id !== id ? old.id : old ? old.id : null;
  }

  /** Solta a arma da mão (a faca não solta). Devolve o que caiu e a munição que tinha. */
  drop(index = this.current): { id: FsWeaponId; ammo: number } | null {
    const s = this.slots[index];
    if (!s || FS_WEAPONS[s.id].slot === 'knife') return null;
    this.slots[index] = null;
    if (this.current === index) {
      this.current = this.slots[1] ? 1 : this.slots[0] ? 0 : 2;
      this.drawT = this.weapon.draw;
      this.reloadT = 0;
      this.inspectT = 0;
    }
    return { id: s.id, ammo: s.ammo };
  }

  update(dt: number, input: FsGunInput, move: FsMoveState, playerId: string): FsGunEvent[] {
    const ev: FsGunEvent[] = [];
    const w = this.weapon;
    const s = this.slot;
    fsGunTick(w, s.gun, dt);
    if (this.drawT > 0) this.drawT = Math.max(0, this.drawT - dt);
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.inspectT > 0) this.inspectT = Math.max(0, this.inspectT - dt);
    let pressed = input.trigger && !this.triggerWas;
    if (pressed && !w.auto && !w.melee && (this.cooldown > 0 || this.drawT > 0) && this.reloadT <= 0) this.buffered = 0.3;
    else if (this.buffered > 0) this.buffered = Math.max(0, this.buffered - dt);
    if (this.buffered > 0 && this.drawT <= 0 && this.cooldown <= 0 && this.reloadT <= 0 && !w.auto) {
      pressed = true;
      this.buffered = 0;
    }
    const altPressed = !!input.alt && !this.altWas;
    this.triggerWas = input.trigger;
    this.altWas = !!input.alt;

    // corpo a corpo: botão de atirar corta, o de mirar estoca
    if (w.melee) {
      if (this.drawT <= 0 && this.cooldown <= 0) {
        // clicar uma vez golpeia uma vez; segurar continua golpeando (corte mais rápido, estocada mais lenta)
        if (input.trigger) {
          this.inspectT = 0;
          this.cooldown = 0.5;
          ev.push({ type: 'melee', kind: 'slash', weapon: w });
        } else if (input.alt) {
          this.inspectT = 0;
          this.cooldown = w.melee.stabCd;
          ev.push({ type: 'melee', kind: 'stab', weapon: w });
        } else if (input.inspect && w.inspect > 0 && this.inspectT <= 0) {
          this.inspectT = w.inspect;
          ev.push({ type: 'inspect', weapon: w });
        }
      }
      return ev;
    }

    // inspecionar (F) com a arma parada: não vale recarregando, sacando ou depois de atirar
    if (input.inspect && w.inspect > 0 && this.ready && this.inspectT <= 0 && !this.reloading) {
      this.inspectT = w.inspect;
      ev.push({ type: 'inspect', weapon: w });
    }
    if (this.dryPending > 0) {
      this.dryPending -= dt;
      if (this.dryPending <= 0 && s.ammo <= 0 && this.reloadT <= 0 && this.drawT <= 0) {
        this.reloadT = w.reload;
        ev.push({ type: 'reload', weapon: w });
        return ev;
      }
    }
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.reloadT = 0;
        s.ammo = w.mag;
        ev.push({ type: 'reloaded', weapon: w });
      }
      return ev;
    }
    if (input.reload && s.ammo < w.mag && this.drawT <= 0) {
      this.reloadT = w.reload;
      this.inspectT = 0;
      ev.push({ type: 'reload', weapon: w });
      return ev;
    }
    const want = w.auto ? input.trigger : pressed;
    if (want && this.drawT <= 0 && this.cooldown <= 0) {
      this.inspectT = 0;
      if (s.ammo <= 0) {
        if (pressed) {
          ev.push({ type: 'dry', weapon: w });
          this.dryPending = 0.3;
          this.cooldown = 0.3;
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
