import { isMuted } from '@/lib/sfx';

/** Sons e música do Night Hunt (arquivos do Slash em public/nighthunt/audio). Respeita o mudo global do NoCap e as opções da partida. */
export type NhSound =
  | 'swing'
  | 'enemyHit'
  | 'playerHit'
  | 'playerDeath'
  | 'xp'
  | 'gold'
  | 'heal'
  | 'magnet'
  | 'chest'
  | 'levelUp'
  | 'horizontal'
  | 'diagonal'
  | 'halo'
  | 'click'
  | 'menuOpen';

const FILES: Record<NhSound, { file: string; vol: number }> = {
  swing: { file: 'sword', vol: 0.55 },
  enemyHit: { file: 'enemy-hit', vol: 0.35 },
  playerHit: { file: 'player-hit', vol: 0.7 },
  playerDeath: { file: 'player-death', vol: 0.8 },
  xp: { file: 'xp', vol: 0.3 },
  gold: { file: 'gold', vol: 0.5 },
  heal: { file: 'heal', vol: 0.7 },
  magnet: { file: 'magnet', vol: 0.8 },
  chest: { file: 'chest', vol: 0.8 },
  levelUp: { file: 'level-up', vol: 0.8 },
  horizontal: { file: 'horizontal', vol: 0.4 },
  diagonal: { file: 'diagonal', vol: 0.4 },
  halo: { file: 'halo', vol: 0.45 },
  click: { file: 'click', vol: 0.7 },
  menuOpen: { file: 'menu-open', vol: 0.7 },
};

export class NhAudio {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private last = new Map<string, number>();
  private music: AudioBufferSourceNode | null = null;
  private musicWanted = false;
  sound = true;
  musicOn = true;
  soundVolume = 1;
  musicVolume = 0.6;

  /** Cria o contexto no primeiro toque (exigência dos navegadores) e carrega os arquivos. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain.connect(this.ctx.destination);
    this.musicGain.connect(this.ctx.destination);
    this.applyVolumes();
    const names = new Set<string>(['music', ...Object.values(FILES).map((f) => f.file)]);
    for (const n of names) void this.load(n);
  }

  private async load(name: string): Promise<void> {
    if (!this.ctx) return;
    try {
      const data = await fetch(`/nighthunt/audio/${name}.mp3`).then((r) => r.arrayBuffer());
      const buf = await this.ctx.decodeAudioData(data);
      this.buffers.set(name, buf);
      if (name === 'music' && this.musicWanted) this.startMusic();
    } catch {
      /* som que não carrega simplesmente não toca */
    }
  }

  applyVolumes(): void {
    if (this.sfxGain) this.sfxGain.gain.value = this.sound && !isMuted() ? this.soundVolume : 0;
    if (this.musicGain)
      this.musicGain.gain.value = this.musicOn && !isMuted() ? this.musicVolume : 0;
  }

  play(n: NhSound, rate = 1): void {
    if (!this.ctx || !this.sfxGain || !this.sound || isMuted()) return;
    const def = FILES[n];
    const buf = this.buffers.get(def.file);
    if (!buf) return;
    const now = this.ctx.currentTime;
    if (now - (this.last.get(n) ?? -1) < 0.045) return;
    this.last.set(n, now);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = def.vol;
    src.connect(g).connect(this.sfxGain);
    src.start();
  }

  startMusic(): void {
    this.musicWanted = true;
    if (!this.ctx || !this.musicGain || this.music) return;
    const buf = this.buffers.get('music');
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.musicGain);
    src.start();
    this.music = src;
  }

  stopMusic(): void {
    this.musicWanted = false;
    try {
      this.music?.stop();
    } catch {
      /* já parada */
    }
    this.music = null;
  }

  pauseAll(on: boolean): void {
    if (!this.ctx) return;
    void (on ? this.ctx.suspend() : this.ctx.resume());
  }

  dispose(): void {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
  }
}
