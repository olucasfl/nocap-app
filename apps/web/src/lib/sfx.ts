import { useSyncExternalStore } from 'react';

/**
 * Sons gerados por Web Audio (zero arquivos). Receitas portadas de
 * docs/reference/prototipo-cor.html. Jogo do Tempo: nenhum som durante a contagem.
 */

const MUTE_KEY = 'nocap-mute';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function audio(): AudioContext | null {
  if (!ctx) {
    const w = window as unknown as { webkitAudioContext?: typeof AudioContext };
    const AC = window.AudioContext ?? w.webkitAudioContext;
    if (!AC) return null;
    // Som ambiente: não interrompe a música do aparelho (iOS).
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'ambient';
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function env(g: GainNode, t: number, a: number, d: number, peak: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay = 0) {
  const c = audio();
  if (!c || !master || muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, 0.004, dur, peak);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(
  filterType: BiquadFilterType,
  f0: number,
  f1: number,
  q: number,
  dur: number,
  peak: number,
  delay = 0,
) {
  const c = audio();
  if (!c || !master || !noiseBuf || muted) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  const fl = c.createBiquadFilter();
  const g = c.createGain();
  src.buffer = noiseBuf;
  fl.type = filterType;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, 0.003, dur, peak);
  src.connect(fl).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

export const sfx = {
  /** toque em botão */
  clack() {
    noise('bandpass', 2600, 2600, 1.2, 0.035, 0.5);
    tone('square', 190, 120, 0.03, 0.08);
  },
  /** a cor aparece */
  flip() {
    noise('bandpass', 500, 3500, 0.8, 0.28, 0.22);
  },
  /** contagem da nota, subindo de tom */
  tick(i: number) {
    tone('triangle', 520 + i * 70, 520 + i * 70, 0.035, 0.14);
  },
  /** tique do slider */
  slide() {
    tone('sine', 1100, 1100, 0.012, 0.05);
  },
  /** carimbo da nota */
  thunk() {
    tone('sine', 170, 42, 0.22, 0.9);
    noise('lowpass', 900, 300, 0.7, 0.07, 0.5);
  },
  /** nota ≥ 9.5 */
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.14, 0.22, 0.09 * i));
  },
  /** nota entre 8 e 9,5: chegou perto (duas notas subindo, mais suaves que o `win`) */
  near() {
    [440, 587].forEach((f, i) => tone('triangle', f, f * 1.01, 0.16, 0.2, 0.1 * i));
  },
  /** o tempo do jogador sobe até a marca (um tique por passo, só no resultado) */
  climb(step: number) {
    tone('triangle', 300 + step * 45, 300 + step * 45, 0.04, 0.1);
  },
  /** nota < 5 */
  boing() {
    tone('sine', 420, 140, 0.32, 0.35);
    tone('sine', 300, 110, 0.3, 0.12, 0.05);
  },
  /** a cor some */
  vanish() {
    tone('sine', 880, 330, 0.16, 0.18);
  },

  // ---- sons de interface: cada ação do app tem o seu (nunca tocam durante a contagem do Tempo) ----

  /** aba Jogos: duas notas subindo */
  navGames() {
    tone('triangle', 523, 523, 0.07, 0.2);
    tone('triangle', 784, 784, 0.1, 0.2, 0.06);
  },
  /** aba Histórico: folhear de página */
  navHistory() {
    noise('bandpass', 1200, 3200, 0.9, 0.12, 0.25);
    tone('sine', 330, 330, 0.05, 0.1, 0.09);
  },
  /** aba Amigos: dois "pops" de gente chegando */
  navFriends() {
    tone('sine', 520, 680, 0.06, 0.22);
    tone('sine', 700, 900, 0.06, 0.22, 0.08);
  },
  /** aba Perfil: sino suave */
  navProfile() {
    tone('sine', 660, 650, 0.28, 0.2);
    tone('sine', 1320, 1300, 0.18, 0.06);
  },
  /** voltar: descida curta */
  back() {
    tone('sine', 700, 430, 0.1, 0.2);
  },
  /** trocar de aba dentro de uma tela: estalo deslizando */
  tab() {
    noise('bandpass', 1800, 2600, 1.4, 0.05, 0.3);
    tone('square', 900, 1250, 0.05, 0.07);
  },
  /** escolher uma opção (modo, filtro, período) */
  select() {
    tone('sine', 480, 760, 0.06, 0.24);
  },
  /** chave ligada / desligada */
  toggleOn() {
    tone('triangle', 560, 560, 0.05, 0.2);
    tone('triangle', 840, 840, 0.08, 0.2, 0.05);
  },
  toggleOff() {
    tone('triangle', 840, 840, 0.05, 0.18);
    tone('triangle', 520, 520, 0.08, 0.18, 0.05);
  },
  /** tema claro: brilho; escuro: sussurro grave */
  themeLight() {
    [1200, 1600, 2000].forEach((f, i) => tone('sine', f, f, 0.07, 0.12, 0.04 * i));
  },
  themeDark() {
    tone('sine', 320, 190, 0.28, 0.25);
    noise('lowpass', 500, 200, 0.7, 0.2, 0.08);
  },
  /** ação que merece atenção (abrir "Sair?") */
  warn() {
    tone('square', 220, 220, 0.07, 0.1);
    tone('square', 220, 220, 0.07, 0.1, 0.11);
  },
  /** despedida: três notas descendo (sair da conta) */
  bye() {
    [660, 523, 392].forEach((f, i) => tone('triangle', f, f, 0.14, 0.2, 0.11 * i));
  },
  /** cancelar / recusar */
  cancel() {
    tone('sine', 400, 300, 0.08, 0.16);
  },
  /** deu certo (entrar, aceitar amigo) */
  success() {
    [523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.1, 0.22, 0.07 * i));
  },
  /** deu errado */
  error() {
    tone('square', 160, 120, 0.12, 0.14);
    tone('square', 130, 100, 0.14, 0.14, 0.14);
  },
  /** chegou um convite ou aviso: sino */
  notify() {
    tone('sine', 880, 870, 0.3, 0.22);
    tone('sine', 1320, 1300, 0.34, 0.14, 0.12);
  },
  /** enviou (pedido de amizade, convite): whoosh */
  send() {
    noise('bandpass', 700, 3800, 0.9, 0.16, 0.26);
  },
  /** removeu (amigo) */
  remove() {
    tone('sine', 380, 160, 0.16, 0.22);
  },
  /** entrar num jogo ou começar uma partida: decolagem */
  start() {
    noise('bandpass', 400, 4000, 0.8, 0.22, 0.22);
    tone('triangle', 330, 660, 0.18, 0.16);
  },
  /** entrou na sala: campainha de porta */
  roomJoin() {
    tone('sine', 740, 740, 0.14, 0.22);
    tone('sine', 587, 587, 0.22, 0.22, 0.14);
  },
  /** passar de página no histórico */
  page() {
    noise('bandpass', 900, 2600, 1, 0.07, 0.22);
  },
  /** voltou a conexão / caiu a conexão */
  online() {
    [440, 660, 880].forEach((f, i) => tone('sine', f, f, 0.08, 0.2, 0.06 * i));
  },
  offline() {
    [660, 440, 300].forEach((f, i) => tone('sine', f, f, 0.1, 0.2, 0.08 * i));
  },
  /** puxar para recarregar: ponto de soltar / recarregando */
  pullReady() {
    tone('triangle', 900, 900, 0.04, 0.16);
  },
  refresh() {
    noise('bandpass', 500, 3000, 0.9, 0.3, 0.22);
  },
  /** CRAVOU (nota 10): fanfarra cheia com brilho e batida */
  perfect() {
    tone('sine', 110, 55, 0.25, 0.5);
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
      tone('triangle', f, f, 0.18, 0.24, 0.07 * i),
    );
    [2093, 2637, 3136].forEach((f, i) => tone('sine', f, f, 0.22, 0.1, 0.45 + 0.07 * i));
  },
  /** nota 5 a 6: encolher de ombros */
  meh() {
    tone('triangle', 330, 294, 0.16, 0.18);
    tone('triangle', 262, 247, 0.24, 0.16, 0.14);
  },
  /** nota 1 a 3: apito caindo e baque */
  awful() {
    tone('sine', 900, 160, 0.5, 0.26);
    tone('sine', 90, 45, 0.25, 0.5, 0.45);
  },
  /** nota 0: trombone triste */
  zero() {
    [233, 220, 208, 196].forEach((f, i) => tone('sawtooth', f, f * 0.97, 0.3, 0.14, 0.28 * i));
    noise('lowpass', 500, 120, 0.7, 0.3, 0.12, 1.1);
  },
  /** novo recorde: fanfarra subindo com brilho no fim */
  record() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.16, 0.24, 0.09 * i));
    [2093, 2637].forEach((f, i) => tone('sine', f, f, 0.2, 0.1, 0.5 + 0.08 * i));
  },
  /** Sobrevivência: passou na rodada (moeda), perdeu uma vida, fim de jogo */
  coin() {
    tone('square', 988, 988, 0.06, 0.12);
    tone('square', 1319, 1319, 0.2, 0.12, 0.07);
  },
  lifeLost() {
    tone('sine', 300, 90, 0.35, 0.4);
    noise('lowpass', 800, 150, 0.7, 0.2, 0.2);
  },
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.98, 0.18, 0.22, 0.14 * i));
  },
};

export type SfxName = keyof typeof sfx;

/** Vibração só onde existe (Android; iOS não suporta). */
export function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* sem suporte */
  }
}

export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* storage indisponível: vale só nesta sessão */
  }
  if (master) master.gain.value = muted ? 0 : 0.9;
  listeners.forEach((l) => l());
  sfx.clack();
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => muted,
  );
}

/**
 * Desbloqueia o áudio no primeiro toque e dá som aos botões. Um elemento com `data-sfx="nome"`
 * toca esse som (`data-sfx` de chave: o som depende de `aria-checked`); sem isso, todo `.btn` dá
 * o "clack". Nada toca durante a contagem do Tempo (tela "valendo").
 */
export function installGlobalSounds() {
  document.addEventListener(
    'pointerdown',
    (e) => {
      audio();
      if (!(e.target instanceof Element)) return;
      if (document.querySelector('.tm-stage.live')) return;
      const el = e.target.closest<HTMLElement>('[data-sfx]');
      if (el && !(el as HTMLButtonElement).disabled) {
        let name = el.dataset.sfx as string;
        if (name === 'toggle')
          name = el.getAttribute('aria-checked') === 'true' ? 'toggleOff' : 'toggleOn';
        const play = sfx[name as SfxName] as (() => void) | undefined;
        if (typeof play === 'function') play();
        buzz(8);
        return;
      }
      if (e.target.closest('.btn')) {
        sfx.clack();
        buzz(8);
      }
    },
    { passive: true },
  );
}
