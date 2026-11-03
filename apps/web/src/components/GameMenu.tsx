import { useEffect, useState, type ReactNode } from 'react';
import { BUILD_ID } from '@/lib/build-id';
import { toggleMute, useMuted } from '@/lib/sfx';
import { closeRoom, sendRoom, useMeId, useRoom } from '@/lib/rooms';
import {
  IcExit,
  IcGear,
  IcInvite,
  IcKeyboard,
  IcNet,
  IcFlag,
  IcPlay,
  IcSound,
} from '@/games/bola/BolaIcons';
import { GameTips, type TipRow } from './GameTips';
import { InviteDialog } from './InviteDialog';
import './game-menu.css';

/** Uma tecla de teclado (some no celular, onde não há teclado). */
export function Keycap({
  k,
  wide = false,
  touchHide = true,
}: {
  k: string;
  wide?: boolean;
  touchHide?: boolean;
}) {
  return (
    <kbd className={`gm-keycap${wide ? ' is-wide' : ''}${touchHide ? ' gm-hide-touch' : ''}`}>
      {k}
    </kbd>
  );
}

/** O botão de engrenagem do canto da tela: abre o menu e mostra a tecla Esc. */
export function GearButton({
  onClick,
  testId,
  label = 'Menu',
}: {
  onClick: () => void;
  testId?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="gm-tool"
      onClick={onClick}
      data-testid={testId}
      aria-label="Abrir o menu"
    >
      <IcGear size={20} />
      <span>{label}</span>
      <Keycap k="Esc" />
    </button>
  );
}

/** O painel pequeno de rede: o que importa para saber se a conexão está boa. */
export function NetBadge({
  mode,
  items,
}: {
  mode: string;
  items: { text: string; title?: string }[];
}) {
  return (
    <div className="gm-net" data-testid="net-badge" aria-label="Rede">
      <b>{mode}</b>
      {items.map((it) => (
        <span key={it.text} title={it.title}>
          {it.text}
        </span>
      ))}
    </div>
  );
}

export interface MenuAction {
  id: string;
  icon: ReactNode;
  label: string;
  /** À direita: uma tecla, o valor atual... */
  hint?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Pede um segundo toque para valer (o botão fica vermelho com este texto). */
  armed?: string;
  testId?: string;
  pressed?: boolean;
}

/**
 * O menu (Esc) dos três jogos: o que é do modo vem de `actions`; o resto é comum: convidar, controles, rede, som e sair.
 * No Fut Fox, por exemplo, "trocar de time" é um `action`; no Atravessa! e no Desmorona! não faz sentido e não aparece.
 */
export function GameMenu({
  title = 'Menu',
  testPrefix,
  continueLabel = 'Continuar jogando',
  actions,
  tips,
  tipsKey,
  net,
  online,
  onClose,
  onExit,
  exitLabel,
  onOfflineInvite,
  escCloses = true,
  endMatch,
}: {
  title?: string;
  testPrefix: string;
  continueLabel?: string;
  actions: MenuAction[];
  /** Os controles do jogo (a tela "Controles"). */
  tips: TipRow[];
  tipsKey: string;
  /** Painel de rede (só online). */
  net?: { on: boolean; toggle: () => void };
  /** Há sala: convidar mostra código e amigos; sem sala, leva para criar uma. */
  online: boolean;
  onClose: () => void;
  onExit: () => void;
  exitLabel?: string;
  onOfflineInvite?: () => void;
  /** Esc fecha o menu. Desligue onde a tela já trata o Esc por conta própria (o Atravessa! pausa e volta com ele). */
  escCloses?: boolean;
  /** Só o líder: encerra a partida com o resultado de agora (o mesmo botão, no mesmo lugar, em todos os jogos). */
  endMatch?: { label: string; onClick: () => void; testId?: string };
}) {
  const muted = useMuted();
  // na sala: "Sair da sala" só tira a pessoa; "Encerrar a sala" (só o líder) apaga a sala para todo mundo
  const meId = useMeId();
  const hostId = useRoom((s) => s.snapshot?.hostId);
  const canCloseRoom = online && !!meId && hostId === meId;
  const paused = useRoom((s) => s.snapshot?.pause?.at != null);
  const pausable = useRoom((s) => !!s.snapshot?.pause);
  const leaveText = exitLabel ?? (online ? 'Sair da sala' : 'Sair da partida');
  const [sure, setSure] = useState(false);
  const [sureClose, setSureClose] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [invite, setInvite] = useState(false);
  const [showTips, setShowTips] = useState(false);
  // Esc de novo fecha o menu (e o convite ou os controles, se estiverem por cima)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      if (invite || showTips) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (invite) setInvite(false);
        else setShowTips(false);
      } else if (escCloses) {
        e.preventDefault();
        // o jogo por baixo não pode tratar o mesmo Esc (senão fecharia e abriria o menu de novo)
        e.stopImmediatePropagation();
        onClose();
      }
    };
    // na captura: roda antes das teclas da própria tela (assim o Esc do convite não pausa nem volta ao jogo)
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [invite, showTips, onClose, escCloses]);
  return (
    <>
      <div
        className="gm-wrap"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testPrefix}
      >
        <div className="gm-card">
          <h2>{title}</h2>
          <button
            type="button"
            className="gm-main"
            onClick={onClose}
            data-testid={`${testPrefix}-continue`}
          >
            <IcPlay size={18} />
            {continueLabel}
          </button>
          {canCloseRoom && pausable && (
            <button
              type="button"
              className="gm-item gm-pause"
              onClick={() => {
                sendRoom(paused ? 'resume' : 'pause');
                onClose();
              }}
              data-testid={`${testPrefix}-pause`}
            >
              <span className="gm-item-main">
                <IcPause size={20} />
                {paused ? 'Despausar' : 'Pausar o jogo'}
              </span>
              <span className="gm-cur">{paused ? 'Volta em 3 segundos' : 'Para todo mundo'}</span>
            </button>
          )}
          {canCloseRoom && endMatch && (
            <ArmedItem
              icon={<IcFlag size={20} />}
              label={endMatch.label}
              armedLabel="Toque de novo para encerrar"
              onConfirm={() => {
                onClose();
                endMatch.onClick();
              }}
              testId={endMatch.testId ?? `${testPrefix}-end`}
            />
          )}
          {actions.map((a) => {
            const isArmed = armed === a.id;
            return (
              <button
                key={a.id}
                type="button"
                className={`gm-item${isArmed ? ' is-sure' : ''}`}
                onClick={() => {
                  if (a.armed && !isArmed) return setArmed(a.id);
                  setArmed(null);
                  a.onClick();
                }}
                onBlur={() => setArmed((cur) => (cur === a.id ? null : cur))}
                disabled={a.disabled}
                aria-pressed={a.pressed}
                data-testid={a.testId}
              >
                <span className="gm-item-main">
                  {a.icon}
                  {isArmed ? a.armed : a.label}
                </span>
                {a.hint}
              </button>
            );
          })}
          <hr className="gm-sep" />
          <button
            type="button"
            className="gm-item"
            onClick={() => setInvite(true)}
            data-testid={`${testPrefix}-invite`}
          >
            <span className="gm-item-main">
              <IcInvite size={20} />
              Convidar
            </span>
            <span className="gm-cur">{online ? 'Link, código, amigos' : 'Sala com amigos'}</span>
          </button>
          <button
            type="button"
            className="gm-item"
            onClick={() => setShowTips(true)}
            data-testid={`${testPrefix}-controls`}
          >
            <span className="gm-item-main">
              <IcKeyboard size={20} />
              Comandos
            </span>
          </button>
          {net && (
            <button
              type="button"
              className="gm-item"
              onClick={net.toggle}
              aria-pressed={net.on}
              data-testid={`${testPrefix}-net`}
            >
              <span className="gm-item-main">
                <IcNet size={20} />
                Painel de rede
              </span>
              <span className="gm-cur">{net.on ? 'Ligado' : 'Desligado'}</span>
            </button>
          )}
          <button
            type="button"
            className="gm-item"
            onClick={toggleMute}
            aria-pressed={muted}
            data-testid={`${testPrefix}-sound`}
          >
            <span className="gm-item-main">
              <IcSound size={20} off={muted} />
              Som
            </span>
            <span className="gm-cur">{muted ? 'Desligado' : 'Ligado'}</span>
          </button>
          <button
            type="button"
            className={`gm-item is-danger${sure ? ' is-sure' : ''}`}
            onClick={() => (sure ? onExit() : setSure(true))}
            onBlur={() => setSure(false)}
            data-testid={`${testPrefix}-exit`}
          >
            <span className="gm-item-main">
              <IcExit size={18} />
              {sure ? 'Toque de novo para sair' : leaveText}
            </span>
          </button>
          {canCloseRoom && (
            <button
              type="button"
              className={`gm-item is-danger is-close${sureClose ? ' is-sure' : ''}`}
              onClick={() => (sureClose ? closeRoom() : setSureClose(true))}
              onBlur={() => setSureClose(false)}
              data-testid={`${testPrefix}-close-room`}
            >
              <span className="gm-item-main">
                <IcExit size={18} />
                {sureClose ? 'Toque de novo para encerrar' : 'Encerrar a sala'}
              </span>
              <span className="gm-cur">Tira todo mundo</span>
            </button>
          )}
          <p className="gm-note mono gm-ver">versão {BUILD_ID}</p>
        </div>
      </div>
      {invite && (
        <InviteDialog
          onClose={() => setInvite(false)}
          onOffline={
            onOfflineInvite
              ? () => {
                  setInvite(false);
                  onOfflineInvite();
                }
              : undefined
          }
        />
      )}
      {showTips && (
        <GameTips
          storageKey={tipsKey}
          title="Comandos"
          rows={tips}
          forced
          onDone={() => setShowTips(false)}
          testId={`${testPrefix}-tips`}
        />
      )}
    </>
  );
}

/** Botão que pede um segundo toque para valer (fica vermelho com o texto de confirmação). */
function ArmedItem({
  icon,
  label,
  armedLabel,
  onConfirm,
  testId,
}: {
  icon: ReactNode;
  label: string;
  armedLabel: string;
  onConfirm: () => void;
  testId: string;
}) {
  const [sure, setSure] = useState(false);
  return (
    <button
      type="button"
      className={`gm-item${sure ? ' is-sure' : ''}`}
      onClick={() => (sure ? onConfirm() : setSure(true))}
      onBlur={() => setSure(false)}
      data-testid={testId}
    >
      <span className="gm-item-main">
        {icon}
        {sure ? armedLabel : label}
      </span>
    </button>
  );
}

function IcPause({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="6" y="5" width="4.5" height="14" rx="1.2" fill="currentColor" />
      <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" fill="currentColor" />
    </svg>
  );
}
