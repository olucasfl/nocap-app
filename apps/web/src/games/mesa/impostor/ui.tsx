import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { COLORS, avatarSrc, iconSrc } from './assets';
import { play, type ImSound } from './audio';

/** Texto que entra palavra por palavra (só `opacity`/`transform`; sem movimento com "reduzir movimento"). */
export function Words({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={`${w}-${i}`} aria-hidden="true">
          {i > 0 && ' '}
          <span className="im-w" style={{ '--i': i } as CSSProperties}>{w}</span>
        </span>
      ))}
    </span>
  );
}

/** Ficha redonda de cor fixa com o personagem por cima. */
export function Coin({ avatar, color, size = 'md', className = '', style }: { avatar: string; color: number; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string; style?: CSSProperties }) {
  return (
    <span className={`im-coin ${size} ${className}`} style={{ '--c': COLORS[color % COLORS.length], ...style } as CSSProperties} aria-hidden="true">
      <img src={avatarSrc(avatar)} alt="" draggable={false} width="176" height="176" />
    </span>
  );
}

export function Icon({ name, className = '', size }: { name: string; className?: string; size?: number }) {
  return <img className={`im-icon ${className}`} src={iconSrc(name)} alt="" draggable={false} width={size ?? 96} height={size ?? 96} />;
}

export const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const BackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
);
export const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const PlusIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
);
export const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
);
export const GearIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>
);

/** Botão principal: afunda ao tocar, brilho ao passar o mouse. Som próprio (não usa o clack global do `.btn`). */
export function Primary({
  children, onClick, disabled, sound = 'start', tone = 'orange', testId, className = '',
}: { children: ReactNode; onClick?: () => void; disabled?: boolean; sound?: ImSound | null; tone?: 'orange' | 'blue' | 'ghost'; testId?: string; className?: string }) {
  return (
    <button
      type="button"
      className={`im-btn ${tone} ${className}`}
      disabled={disabled}
      data-testid={testId}
      onClick={() => {
        if (sound) play(sound);
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

/** O ranking da sessão (faixa pequena sempre à vista) entra aqui para qualquer barra do topo. */
export const RankSlot = createContext<ReactNode>(null);

export function TopBar({ onBack, center, right, leave }: { onBack?: () => void; center?: ReactNode; right?: ReactNode; /** Sair no meio da partida: mostra um X em vez da seta. */ leave?: boolean }) {
  const rank = useContext(RankSlot);
  return (
    <div className="im-top">
      {onBack ? (
        <button type="button" className="im-iconbtn" aria-label={leave ? 'Sair da partida' : 'Voltar'} data-testid={leave ? 'im-leave' : 'im-back'} onClick={() => { play('back'); onBack(); }}>
          {leave ? <CloseIcon /> : <BackIcon />}
        </button>
      ) : (
        <span className="im-spacer" />
      )}
      <div className="im-top-c">{center}</div>
      <div className="im-top-r">{right ?? rank ?? <span className="im-spacer" />}</div>
    </div>
  );
}

export function Steps({ at }: { at: number }) {
  return (
    <div className="im-steps" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <i key={i} className={`${i <= at ? 'on' : ''} ${i === at ? 'cur' : ''}`} />
      ))}
    </div>
  );
}

export function Sheet({ title, onClose, children, icon }: { title: string; onClose: () => void; children: ReactNode; icon?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <>
      <div className="im-scrim" onClick={() => { play('back'); onClose(); }} />
      <div className="im-sheet" role="dialog" aria-label={title} tabIndex={-1} ref={ref}>
        <span className="im-grab" />
        <div className="im-sheet-head">{icon}<h3>{title}</h3></div>
        {children}
      </div>
    </>
  );
}

export function Stepper({ value, label, onChange, min, max, format }: { value: number; label: string; onChange: (n: number) => void; min: number; max: number; format?: (n: number) => string }) {
  return (
    <div className="im-stepper">
      <button type="button" aria-label={`Menos ${label}`} disabled={value <= min} onClick={() => { play('select'); onChange(Math.max(min, value - 1)); }}>−</button>
      <output aria-label={label}>{format ? format(value) : value}</output>
      <button type="button" aria-label={`Mais ${label}`} disabled={value >= max} onClick={() => { play('select'); onChange(Math.min(max, value + 1)); }}>+</button>
    </div>
  );
}

export function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="im-switch"
      onClick={() => { play(on ? 'off' : 'on'); onChange(!on); }}
    />
  );
}

/** Aviso de erro bem visível: faixa vermelha que treme ao aparecer (só transform/opacity) e fala em voz alta para leitor de tela. */
export function Alert({ children, n }: { children: ReactNode; n: number }) {
  return (
    <div className="im-alert" role="alert" key={n}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5M12 17h.01" /><path d="M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></svg>
      <span>{children}</span>
    </div>
  );
}

/** Guarda a mensagem de erro e um contador para o aviso tremer de novo a cada tentativa. */
export function useFlash(): [{ m: string; n: number } | null, (m: string) => void, () => void] {
  const [f, setF] = useState<{ m: string; n: number } | null>(null);
  const show = useCallback((m: string) => {
    play('remove', 0.7);
    setF((p) => ({ m, n: (p?.n ?? 0) + 1 }));
  }, []);
  const clear = useCallback(() => setF(null), []);
  return [f, show, clear];
}

export interface AskCfg {
  title: string;
  text: string;
  confirm: string;
  cancel?: string;
  danger?: boolean;
  onConfirm: () => void;
}
/** Pede confirmação antes de algo difícil de desfazer (sair da partida, encerrar, zerar o ranking...). */
export const AskCtx = createContext<(c: AskCfg) => void>(() => undefined);
export const useAsk = () => useContext(AskCtx);

export function Confirm({ cfg, onClose }: { cfg: AskCfg; onClose: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus({ preventScroll: true });
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <>
      <div className="im-scrim strong" onClick={onClose} />
      <div className="im-confirm" role="alertdialog" aria-modal="true" aria-label={cfg.title}>
        <h3>{cfg.title}</h3>
        <p>{cfg.text}</p>
        <div className="im-confirm-btns">
          <button type="button" className="im-btn ghost" ref={cancel} data-testid="im-confirm-no" onClick={() => { play('back'); onClose(); }}>{cfg.cancel ?? 'Cancelar'}</button>
          <button type="button" className={`im-btn ${cfg.danger ? 'danger' : ''}`} data-testid="im-confirm-yes" onClick={() => { play('confirm'); onClose(); cfg.onConfirm(); }}>{cfg.confirm}</button>
        </div>
      </div>
    </>
  );
}
