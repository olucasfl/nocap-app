import { create } from 'zustand';

/** Ações que o jogador pode remapear (teclado e botões do mouse). Os nomes das teclas são `KeyboardEvent.code`; mouse é `Mouse0`, `Mouse1`, `Mouse2`. */
export const FS_ACTIONS = [
  { id: 'forward', label: 'Andar para a frente' },
  { id: 'back', label: 'Andar para trás' },
  { id: 'left', label: 'Andar para a esquerda' },
  { id: 'right', label: 'Andar para a direita' },
  { id: 'jump', label: 'Pular' },
  { id: 'fire', label: 'Atirar' },
  { id: 'ads', label: 'Mirar' },
  { id: 'reload', label: 'Recarregar' },
  { id: 'slot1', label: 'Arma 1 (primária)' },
  { id: 'slot2', label: 'Arma 2 (secundária)' },
  { id: 'slot3', label: 'Arma 3 (faca)' },
  { id: 'crouch', label: 'Agachar' },
  { id: 'walk', label: 'Andar devagar (sem barulho)' },
  { id: 'inspect', label: 'Inspecionar a arma' },
  { id: 'buy', label: 'Loja' },
  { id: 'drop', label: 'Largar a arma' },
  { id: 'pickup', label: 'Pegar do chão' },
  { id: 'next', label: 'Próxima arma' },
  { id: 'grenade', label: 'Pegar granada (passa por todas)' },
  { id: 'grenadeFrag', label: 'Pegar a granada explosiva' },
  { id: 'grenadeFlash', label: 'Pegar a granada de luz' },
  { id: 'scoreboard', label: 'Placar (segurar)' },
  { id: 'map', label: 'Mapa grande (abre e fecha)' },
] as const;
export type FsAction = (typeof FS_ACTIONS)[number]['id'];

/** Os comandos agrupados por categoria (a ordem é a da tela de Comandos). */
export const FS_CATS: { id: string; label: string; ids: FsAction[] }[] = [
  { id: 'move', label: 'Movimento', ids: ['forward', 'back', 'left', 'right', 'jump', 'crouch', 'walk'] },
  { id: 'weapons', label: 'Armas', ids: ['fire', 'ads', 'reload', 'inspect', 'slot1', 'slot2', 'slot3', 'next', 'drop', 'pickup', 'buy'] },
  { id: 'grenades', label: 'Granadas', ids: ['grenade', 'grenadeFrag', 'grenadeFlash'] },
  { id: 'general', label: 'Geral', ids: ['scoreboard', 'map'] },
];

export const FS_DEFAULT_BINDS: Record<FsAction, string> = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  fire: 'Mouse0',
  ads: 'Mouse2',
  reload: 'KeyR',
  slot1: 'Digit1',
  slot2: 'Digit2',
  slot3: 'Digit3',
  crouch: 'ControlLeft',
  walk: 'ShiftLeft',
  inspect: 'KeyF',
  buy: 'KeyB',
  drop: 'KeyG',
  pickup: 'KeyE',
  next: 'KeyQ',
  grenade: 'Digit4',
  grenadeFrag: '',
  grenadeFlash: '',
  scoreboard: 'Tab',
  map: 'KeyM',
};

export type CrosshairColor = 'white' | 'green' | 'yellow' | 'cyan' | 'pink';
export const CROSS_COLORS: Record<CrosshairColor, string> = {
  white: '#ffffff',
  green: '#4dff7c',
  yellow: '#ffe14d',
  cyan: '#4df2ff',
  pink: '#ff7ad9',
};

export interface FsSettings {
  /** Graus por pixel do mouse. */
  sens: number;
  /** Multiplicador da sensibilidade ao mirar. */
  adsSens: number;
  fov: number;
  invertY: boolean;
  /** Mira: cor, comprimento, espessura, vão fixo, ponto no centro e se abre com a dispersão. */
  crossColor: CrosshairColor;
  crossSize: number;
  crossThick: number;
  crossGap: number;
  crossDot: boolean;
  crossDynamic: boolean;
  showTelemetry: boolean;
  showMinimap: boolean;
  /** Tamanho do mapa pequeno no canto. */
  minimapSize: 'small' | 'medium' | 'large';
  /** Joga em tela cheia e trava as teclas do navegador (Ctrl+W, Ctrl+R, Ctrl+T...) enquanto joga. */
  fullscreenLock: boolean;
  /** 'auto' deixa o jogo subir e descer a qualidade pelo fps. */
  quality: 'auto' | 'low' | 'mid' | 'high';
  binds: Record<FsAction, string>;
}

export const FS_DEFAULTS: FsSettings = {
  sens: 0.09,
  adsSens: 0.8,
  fov: 75,
  invertY: false,
  crossColor: 'white',
  crossSize: 9,
  crossThick: 2,
  crossGap: 4,
  crossDot: false,
  crossDynamic: true,
  showTelemetry: false,
  showMinimap: true,
  minimapSize: 'medium',
  fullscreenLock: true,
  quality: 'auto',
  binds: { ...FS_DEFAULT_BINDS },
};

const KEY = 'nocap-fs-settings';

function load(): FsSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...FS_DEFAULTS, binds: { ...FS_DEFAULT_BINDS } };
    const p = JSON.parse(raw) as Partial<FsSettings>;
    // a trava de teclas (Ctrl+W) passou a vir ligada: quem já tinha salvo "desligada" recebe a nova padrão uma vez
    if (localStorage.getItem(KEY + '-lock2') !== '1') {
      p.fullscreenLock = true;
      localStorage.setItem(KEY + '-lock2', '1');
    }
    // o medidor de desempenho (FPS) passou a vir desligado: quem já tinha salvo "ligado" também recebe o novo padrão uma vez
    if (localStorage.getItem(KEY + '-perf2') !== '1') {
      p.showTelemetry = false;
      localStorage.setItem(KEY + '-perf2', '1');
    }
    return { ...FS_DEFAULTS, ...p, binds: { ...FS_DEFAULT_BINDS, ...(p.binds ?? {}) } };
  } catch {
    return { ...FS_DEFAULTS, binds: { ...FS_DEFAULT_BINDS } };
  }
}

interface Store extends FsSettings {
  set: (patch: Partial<FsSettings>) => void;
  /** Põe `code` na ação. Se outra ação já usava a mesma tecla, as duas ficam e o menu avisa o conflito. */
  bind: (action: FsAction, code: string) => void;
  reset: () => void;
}

export const useFsSettings = create<Store>((set, get) => ({
  ...load(),
  set: (patch) => {
    set(patch);
    persist(get());
  },
  bind: (action, code) => {
    const binds = { ...get().binds };
    binds[action] = code;
    set({ binds });
    persist(get());
  },
  reset: () => {
    set({ ...FS_DEFAULTS, binds: { ...FS_DEFAULT_BINDS } });
    persist(get());
  },
}));

function persist(s: Store) {
  try {
    const { set: _s, bind: _b, reset: _r, ...data } = s;
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

export const fsSettings = (): FsSettings => useFsSettings.getState();

const NAMES: Record<string, string> = {
  Space: 'Espaço',
  Tab: 'Tab',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  Mouse0: 'Mouse 1 (esquerdo)',
  Mouse1: 'Mouse 3 (roda)',
  Mouse2: 'Mouse 2 (direito)',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Enter: 'Enter',
  Backquote: '`',
};

/** Nome legível de uma tecla ou botão. */
export function bindLabel(code: string): string {
  if (!code) return 'Nenhuma';
  if (NAMES[code]) return NAMES[code]!;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}
