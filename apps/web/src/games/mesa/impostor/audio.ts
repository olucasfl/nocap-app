import { audioKit } from '@/lib/sfx';

/**
 * Sons do Impostor: arquivos CC0 (Kenney) escolhidos pelo Lucas, tocados por Web Audio no mesmo contexto do resto do app
 * (respeita o mudo). Cada nome é uma situação do jogo; ver specs/088-impostor.md, seção 7b.
 */
export type ImSound =
  | 'tap' | 'select' | 'on' | 'off' | 'back' | 'start' | 'confirm' | 'add' | 'remove' | 'shuffle'
  | 'reveal' | 'pass' | 'vote' | 'tick' | 'timeup' | 'win' | 'lose' | 'rankcalm' | 'rankbig';

const buffers = new Map<ImSound, AudioBuffer>();
const loading = new Map<ImSound, Promise<void>>();
const ALL: ImSound[] = ['tap', 'select', 'on', 'off', 'back', 'start', 'confirm', 'add', 'remove', 'shuffle', 'reveal', 'pass', 'vote', 'tick', 'timeup', 'win', 'lose', 'rankcalm', 'rankbig'];

function load(name: ImSound, ctx: AudioContext): Promise<void> {
  let p = loading.get(name);
  if (!p) {
    p = fetch(`/impostor/sfx/${name}.mp3`)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx.decodeAudioData(b))
      .then((buf) => void buffers.set(name, buf))
      .catch(() => undefined);
    loading.set(name, p);
  }
  return p;
}

/** Baixa e decodifica todos os sons (cerca de 120 KB); chamado no primeiro toque da pessoa. */
export function preloadSounds(): void {
  const kit = audioKit();
  if (!kit) return;
  for (const n of ALL) void load(n, kit.ctx);
}

export function play(name: ImSound, volume = 1): void {
  const kit = audioKit();
  if (!kit || kit.muted()) return;
  const buf = buffers.get(name);
  if (!buf) {
    void load(name, kit.ctx);
    return;
  }
  const src = kit.ctx.createBufferSource();
  const g = kit.ctx.createGain();
  g.gain.value = volume;
  src.buffer = buf;
  src.connect(g).connect(kit.out);
  src.start();
}
