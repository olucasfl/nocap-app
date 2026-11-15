import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from 'react';
import './fs-touch.css';

export type TouchName =
  'fire' | 'ads' | 'jump' | 'reload' | 'cycle' | 'use' | 'buy' | 'bombslot' | 'crouch';

const ic = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;
const ICONS: Record<string, ReactNode> = {
  fire: (
    <svg {...ic} aria-hidden="true">
      <path d="M12 3c2 2 3 4.5 3 7v8H9v-8c0-2.5 1-5 3-7z" fill="currentColor" stroke="none" />
      <path d="M8 21h8" />
    </svg>
  ),
  ads: (
    <svg {...ic} aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v6M12 16v6M2 12h6M16 12h6" />
    </svg>
  ),
  jump: (
    <svg {...ic} aria-hidden="true">
      <path d="M6 14l6-6 6 6M6 20l6-6 6 6" />
    </svg>
  ),
  crouch: (
    <svg {...ic} aria-hidden="true">
      <path d="M6 5l6 6 6-6M6 11l6 6 6-6" />
      <path d="M5 21h14" />
    </svg>
  ),
  reload: (
    <svg {...ic} aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-2.5-5.8" />
      <path d="M20 3v5h-5" />
    </svg>
  ),
  cycle: (
    <svg {...ic} aria-hidden="true">
      <path d="M4 9h14l-3-3M20 15H6l3 3" />
    </svg>
  ),
  buy: (
    <svg {...ic} aria-hidden="true">
      <path d="M3 4h3l2.4 11h9.2L20 8H7" />
      <circle cx="9.5" cy="19.5" r="1.4" fill="currentColor" />
      <circle cx="17" cy="19.5" r="1.4" fill="currentColor" />
    </svg>
  ),
  menu: (
    <svg {...ic} aria-hidden="true">
      <path d="M9 5v14M15 5v14" />
    </svg>
  ),
  use: (
    <svg {...ic} aria-hidden="true">
      <circle cx="11" cy="14" r="6" />
      <path d="M15 9l3-3M18 3v3M16 6h4" />
    </svg>
  ),
};

interface BtnProps {
  cls: string;
  icon: string;
  label: string;
  aria: string;
  onDown: () => void;
  onUp?: () => void;
  /** Arrastar o dedo em cima do botão também mira (atirar e mirar). */
  onDrag?: (dx: number, dy: number) => void;
  on?: boolean;
  testId?: string;
  text?: string;
}

function TBtn({ cls, icon, label, aria, onDown, onUp, onDrag, on, testId, text }: BtnProps) {
  const last = useRef<{ x: number; y: number } | null>(null);
  const down = (e: RPointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* sem captura: o botão solta pelo cancelamento */
    }
    last.current = { x: e.clientX, y: e.clientY };
    onDown();
  };
  const up = () => {
    last.current = null;
    onUp?.();
  };
  return (
    <button
      type="button"
      className={`tc ${cls}${on ? ' on' : ''}`}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerMove={(e) => {
        if (!onDrag || !last.current) return;
        onDrag(e.clientX - last.current.x, e.clientY - last.current.y);
        last.current = { x: e.clientX, y: e.clientY };
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={aria}
      data-testid={testId}
    >
      {text ? <b className="tc-text">{text}</b> : ICONS[icon]}
      <span>{label}</span>
    </button>
  );
}

/**
 * Botões do celular no desenho de Call of Duty Mobile: tiro grande no canto de baixo à direita (arrastar nele também mira),
 * mirar, pular, agachar e recarregar em volta dele, tiro extra à esquerda, e loja e menu no canto de cima.
 * O joystick de andar é flutuante (aparece onde o dedo toca na metade esquerda da tela).
 */
export function FsTouchControls({
  press,
  look,
  onMenu,
  onShop,
  bomb,
  hasShop = true,
}: {
  press: (name: TouchName, down: boolean) => void;
  look: (dx: number, dy: number) => void;
  onMenu: () => void;
  onShop: () => void;
  /** Modo Bomba: botões da C4 (só quem carrega) e de plantar ou desarmar. */
  bomb?: { carrier: boolean } | null;
  hasShop?: boolean;
}) {
  const [crouch, setCrouch] = useState(false);
  return (
    <div className="tc-layer" data-testid="fs-touch">
      <div className="tc-top">
        {hasShop && (
          <button
            type="button"
            className="tc tc-sm"
            onClick={onShop}
            aria-label="Loja"
            data-testid="fs-tb-shop"
          >
            {ICONS.buy}
            <span>LOJA</span>
          </button>
        )}
        <button
          type="button"
          className="tc tc-sm"
          onClick={onMenu}
          aria-label="Menu"
          data-testid="fs-menubtn"
        >
          {ICONS.menu}
          <span>MENU</span>
        </button>
      </div>
      <TBtn
        cls="tc-fire2"
        icon="fire"
        label=""
        aria="Atirar (esquerda)"
        onDown={() => press('fire', true)}
        onUp={() => press('fire', false)}
        onDrag={look}
      />
      <TBtn
        cls="tc-fire"
        icon="fire"
        label="ATIRAR"
        aria="Atirar"
        onDown={() => press('fire', true)}
        onUp={() => press('fire', false)}
        onDrag={look}
        testId="fs-tb-fire"
      />
      <TBtn
        cls="tc-ads"
        icon="ads"
        label="MIRAR"
        aria="Mirar"
        onDown={() => press('ads', true)}
        onUp={() => press('ads', false)}
      />
      <TBtn
        cls="tc-jump"
        icon="jump"
        label="PULAR"
        aria="Pular"
        onDown={() => press('jump', true)}
      />
      <TBtn
        cls="tc-crouch"
        icon="crouch"
        label="AGACHAR"
        aria="Agachar"
        on={crouch}
        onDown={() => {
          setCrouch((v) => !v);
          press('crouch', true);
        }}
      />
      <TBtn
        cls="tc-reload"
        icon="reload"
        label="RECARGA"
        aria="Recarregar"
        onDown={() => press('reload', true)}
      />
      <TBtn
        cls="tc-cycle"
        icon="cycle"
        label="TROCAR"
        aria="Trocar de arma"
        onDown={() => press('cycle', true)}
      />
      {bomb && (
        <div className="tc-bomb">
          {bomb.carrier && (
            <TBtn
              cls="tc-sm"
              icon=""
              text="C4"
              label="PEGAR"
              aria="Pegar a C4 na mão"
              testId="fs-tb-c4"
              onDown={() => press('bombslot', true)}
            />
          )}
          <TBtn
            cls="tc-sm tc-use"
            icon="use"
            label="BOMBA"
            aria="Plantar ou desarmar"
            testId="fs-tb-use"
            onDown={() => press('use', true)}
            onUp={() => press('use', false)}
          />
        </div>
      )}
    </div>
  );
}

/** Tenta travar a tela na horizontal (funciona no app instalado e em tela cheia); no navegador comum o aviso "gire o aparelho" cobre o resto. */
export function useLandscapeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const so = (typeof screen !== 'undefined' ? screen.orientation : undefined) as
      (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
    try {
      void so?.lock?.('landscape')?.catch(() => undefined);
    } catch {
      /* sem permissão: vale o aviso de girar */
    }
    return () => {
      try {
        so?.unlock?.();
      } catch {
        /* nada a soltar */
      }
    };
  }, [active]);
}
