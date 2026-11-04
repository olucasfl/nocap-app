import { fsFire, fsGunTick, fsNewGunState, type FsGunState, type FsMoveState, type FsShot } from './recoil';
import { FS_GRENADES, fsThrowPower, type FsGrenadeId } from './grenades';
import { FS_SLOT_ORDER, FS_WEAPONS, type FsSlot, type FsWeapon, type FsWeaponId } from './weapons';

export type FsGunEvent =
  | { type: 'fire'; shot: FsShot; weapon: FsWeapon }
  | { type: 'melee'; kind: 'slash' | 'stab'; weapon: FsWeapon }
  | { type: 'dry'; weapon: FsWeapon }
  | { type: 'reload'; weapon: FsWeapon }
  | { type: 'reloaded'; weapon: FsWeapon }
  | { type: 'draw'; weapon: FsWeapon }
  | { type: 'inspect'; weapon: FsWeapon }
  | { type: 'bolt'; weapon: FsWeapon }
  /** Granada: tirou o pino (começa a segurar) e arremesso (força de 0 a 1). */
  | { type: 'pin'; grenade: FsGrenadeId }
  | { type: 'throw'; grenade: FsGrenadeId; power: number; style: 'far' | 'mid' | 'near' }
  | { type: 'grenadeDraw'; grenade: FsGrenadeId };

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
  /** Já deu o clique de arma vazia (o próximo clique recarrega). */
  private dryClicked = false;
  private altWas = false;

  constructor(primary: FsWeaponId | null = 'ak', secondary: FsWeaponId | null = 'pistol') {
    const mk = (id: FsWeaponId | null): Slot | null => (id ? { id, ammo: FS_WEAPONS[id].mag, gun: fsNewGunState() } : null);
    this.slots = [mk(primary), mk(secondary), mk('knife')];
    this.current = primary ? 0 : secondary ? 1 : 2;
  }

  /** Renasceu: os pentes de todas as armas voltam cheios (as granadas gastas não voltam: compra de novo na loja). */
  refillAmmo() {
    for (const sl of this.slots) {
      if (!sl) continue;
      sl.ammo = FS_WEAPONS[sl.id].mag;
      sl.gun = fsNewGunState();
    }
    this.reloadT = 0;
    this.cooldown = 0;
    this.inspectT = 0;
    this.buffered = 0;
    this.dryClicked = false;
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

  // ---- granadas: quantas tem, qual está na mão, o arremesso em andamento
  grenades: Record<FsGrenadeId, number> = { frag: 0, flash: 0 };
  held: FsGrenadeId | null = null;
  /** Segundos com o pino tirado (só para animação). */
  charge = 0;
  pinOut = false;
  /** Botões usados desde que o pino saiu: esquerdo = lança longe, direito = lança perto, os dois = média distância (como no CS). */
  private nadeL = false;
  private nadeR = false;
  /** Como vai ser o arremesso agora. */
  get throwStyle(): 'far' | 'mid' | 'near' {
    return this.nadeL && this.nadeR ? 'mid' : this.nadeR ? 'near' : 'far';
  }
  private throwCd = 0;

  /** Pega uma granada (loja ou chão). Falso se já está no máximo. */
  addGrenade(kind: FsGrenadeId): boolean {
    if (this.grenades[kind] >= FS_GRENADES[kind].max) return false;
    this.grenades[kind]++;
    return true;
  }

  /** Põe a granada na mão (ou, se já está nela, volta para a arma). `next` passa pela primeira e pela outra e depois volta à arma. */
  selectGrenade(which: FsGrenadeId | 'next'): FsGunEvent[] {
    if (this.pinOut) return []; // soltando a granada não troca
    const have = (['frag', 'flash'] as FsGrenadeId[]).filter((k) => this.grenades[k] > 0);
    let to: FsGrenadeId | null;
    if (which === 'next') {
      if (!this.held) to = have[0] ?? null;
      else {
        const i = have.indexOf(this.held);
        to = i >= 0 && i + 1 < have.length ? have[i + 1]! : null;
      }
      if (!this.held && !to) return [];
    } else {
      if (this.grenades[which] <= 0 && this.held !== which) return [];
      to = this.held === which ? null : which;
    }
    this.reloadT = 0;
    this.inspectT = 0;
    this.charge = 0;
    this.triggerWas = false;
    this.held = to;
    if (to) {
      this.drawT = 0.5;
      return [{ type: 'grenadeDraw', grenade: to }];
    }
    this.drawT = this.weapon.draw;
    return [{ type: 'draw', weapon: this.weapon }];
  }

  /** Roda do mouse: passa por todas as armas e granadas (1, 2, 3, granadas), na ordem. */
  cycleAll(dir: 1 | -1 = 1): FsGunEvent[] {
    if (this.pinOut) return [];
    type Entry = { t: 'slot'; i: number } | { t: 'g'; k: FsGrenadeId };
    const list: Entry[] = [];
    this.slots.forEach((s, i) => s && list.push({ t: 'slot', i }));
    (['frag', 'flash'] as FsGrenadeId[]).forEach((k) => this.grenades[k] > 0 && list.push({ t: 'g', k }));
    const cur = list.findIndex((e) => (this.held ? e.t === 'g' && e.k === this.held : e.t === 'slot' && e.i === this.current));
    const next = list[(Math.max(0, cur) + dir + list.length) % list.length]!;
    if (next.t === 'g') {
      if (this.held === next.k) return [];
      this.held = null;
      return this.selectGrenade(next.k);
    }
    const wasHeld = this.held;
    this.held = null;
    this.charge = 0;
    if (wasHeld && next.i === this.current) {
      this.drawT = this.weapon.draw;
      return [{ type: 'draw', weapon: this.weapon }];
    }
    return this.switchTo(next.i);
  }

  switchTo(index: number): FsGunEvent[] {
    if (this.pinOut) return [];
    const wasHeld = this.held;
    if (wasHeld) {
      // saindo da granada para uma arma
      this.held = null;
      this.charge = 0;
      if (index === this.current) {
        this.drawT = this.weapon.draw;
        this.triggerWas = false;
        return [{ type: 'draw', weapon: this.weapon }];
      }
    }
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
    // com uma granada na mão: segurar o botão tira o pino e carrega a força; soltar arremessa
    if (this.held) {
      const g = this.held;
      if (this.drawT > 0) this.drawT = Math.max(0, this.drawT - dt);
      if (this.throwCd > 0) {
        this.throwCd -= dt;
        if (this.throwCd <= 0) {
          // acabou o arremesso: fica com a outra granada, se tiver, ou volta para a arma
          this.throwCd = 0;
          if (this.grenades[g] > 0) return ev;
          const other = (['frag', 'flash'] as FsGrenadeId[]).find((k) => this.grenades[k] > 0);
          this.held = other ?? null;
          this.drawT = other ? 0.5 : this.weapon.draw;
          ev.push(other ? { type: 'grenadeDraw', grenade: other } : { type: 'draw', weapon: this.weapon });
        }
        this.triggerWas = input.trigger;
        return ev;
      }
      const any = input.trigger || !!input.alt;
      if (!this.pinOut && any && !(this.triggerWas || this.altWas) && this.drawT <= 0) {
        // apertar tira o pino; o botão apertado define o arremesso
        this.pinOut = true;
        this.charge = 0;
        this.nadeL = input.trigger;
        this.nadeR = !!input.alt;
        ev.push({ type: 'pin', grenade: g });
      } else if (this.pinOut) {
        this.charge = Math.min(1.2, this.charge + dt);
        if (input.trigger) this.nadeL = true;
        if (input.alt) this.nadeR = true;
        if (!any) {
          const style = this.throwStyle;
          ev.push({ type: 'throw', grenade: g, power: fsThrowPower(style), style });
          this.grenades[g]--;
          this.pinOut = false;
          this.charge = 0;
          this.nadeL = this.nadeR = false;
          this.throwCd = 0.6;
        }
      }
      this.triggerWas = input.trigger;
      this.altWas = !!input.alt;
      return ev;
    }
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
    if (s.ammo > 0) this.dryClicked = false;
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
    // sem bala: segurando o gatilho faz o clique de arma vazia sozinho (uma vez); clicar de novo recarrega
    if (s.ammo <= 0 && this.drawT <= 0 && this.cooldown <= 0) {
      if (!this.dryClicked) {
        if (input.trigger) {
          this.dryClicked = true;
          this.cooldown = 0.25;
          this.inspectT = 0;
          ev.push({ type: 'dry', weapon: w });
        }
      } else if (pressed) {
        this.reloadT = w.reload;
        this.inspectT = 0;
        ev.push({ type: 'reload', weapon: w });
      }
      return ev;
    }
    const want = w.auto ? input.trigger : pressed;
    if (want && this.drawT <= 0 && this.cooldown <= 0) {
      this.inspectT = 0;
      s.ammo--;
      this.cooldown = Math.max(60 / w.rpm, w.boltS);
      ev.push({ type: 'fire', shot: fsFire(w, s.gun, move, playerId), weapon: w });
      if (w.boltS > 0) ev.push({ type: 'bolt', weapon: w });
    }
    return ev;
  }
}
