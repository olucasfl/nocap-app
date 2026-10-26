import { useEffect, useRef, useState } from 'react';
import type { Conflict, ConflictChoice, SyncedSaveStore, SyncState } from './api-save-store';
import type { SaveSlot } from './save-store';
import { useDialog } from './useDialog';
import './sync-notice.css';

/**
 * Avisos para o que não trava o jogo (spec 038, 10.4). `saved` e `saving` não mostram nada. O texto aparece num aviso
 * curto que some sozinho; o que fica na tela é só um ícone pequeno (ver `SyncView`).
 */
export const SYNC_STRIP: Partial<Record<SyncState, string>> = {
  offline:
    'Sem conexão com a conta. Você segue jogando e o progresso sobe quando a internet voltar.',
  error: 'Não deu para salvar na conta. O progresso fica neste aparelho e a gente tenta de novo.',
  'signed-out': 'Sua sessão acabou. Entre de novo para continuar salvando na conta.',
};

/** Aviso curto quando a conexão volta e o que estava pendente sobe. */
export const SYNC_BACK = 'Conexão de volta. Seu progresso foi salvo na conta.';

/** Quanto tempo cada aviso fica na tela (o ícone de sem conexão fica até a internet voltar). */
export const TOAST_MS = { problem: 5000, back: 3500 } as const;

const NET_ICON: Record<'offline' | 'error' | 'signed-out', string> = {
  // Wi-Fi riscado, nuvem com exclamação, cadeado.
  offline:
    'M2 8.8a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01M3 3l18 18',
  error: 'M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5 4 4 0 0 1 17.5 18zM12 9v4M12 15.5h.01',
  'signed-out': 'M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3',
};

const CHOICE_LABEL: Record<ConflictChoice, string> = {
  merge: 'Juntar (recomendado)',
  account: 'Usar o da conta',
  device: 'Usar o deste aparelho',
};

const CONFIRM_TEXT: Record<Exclude<ConflictChoice, 'merge'>, string> = {
  account: 'O progresso deste aparelho deixa de valer. Uma cópia dele fica guardada aqui.',
  device: 'O progresso que está na conta deixa de valer. Uma cópia dele fica guardada aqui.',
};

const lives = (n: number) => (n === 1 ? '1 colapso' : `${n} colapsos`);

interface ViewProps {
  sync: SyncState;
  conflict: Conflict | null;
  /** Escolha que espera o segundo passo (só as que descartam algo). */
  confirming: ConflictChoice | null;
  busy: boolean;
  failed: boolean;
  onChoose: (choice: ConflictChoice) => void;
  onCancel: () => void;
  /** O aviso de texto está à vista (some depois de alguns segundos; o ícone fica). Padrão: à vista. */
  showToast?: boolean;
  /** A internet acabou de voltar: mostra o aviso de "conexão de volta" no lugar do ícone. */
  recovered?: boolean;
  /** Tocar no ícone mostra o aviso de novo. */
  onReveal?: () => void;
}

/** Só a aparência: faixa de aviso ou o diálogo "Este save mudou em outro aparelho". */
export function SyncView({
  sync,
  conflict,
  confirming,
  busy,
  failed,
  onChoose,
  onCancel,
  showToast = true,
  recovered = false,
  onReveal,
}: ViewProps) {
  const root = useRef<HTMLDivElement>(null);
  useDialog(root, () => {});
  if (conflict) {
    const needsConfirm = confirming && confirming !== 'merge' ? confirming : null;
    return (
      <div className="ap-sync-wrap">
        <div
          ref={root}
          className="ap-sync-card"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="ap-sync-title"
          tabIndex={-1}
        >
          <h2 id="ap-sync-title">Este save mudou em outro aparelho</h2>
          <p className="ap-sync-sub">
            Na conta: {lives(conflict.account.collapses)}. Neste aparelho:{' '}
            {lives(conflict.local.collapses)}. Nada foi sobrescrito. Escolha como seguir.
          </p>
          {needsConfirm ? (
            <>
              <p className="ap-sync-warn">{CONFIRM_TEXT[needsConfirm]}</p>
              <div className="ap-sync-row">
                <button
                  type="button"
                  className="ap-sync-btn danger"
                  disabled={busy}
                  onClick={() => onChoose(needsConfirm)}
                >
                  Sim, {CHOICE_LABEL[needsConfirm].toLowerCase()}
                </button>
                <button
                  type="button"
                  className="ap-sync-btn ghost"
                  disabled={busy}
                  onClick={onCancel}
                >
                  Voltar
                </button>
              </div>
            </>
          ) : (
            <div className="ap-sync-col">
              <button
                type="button"
                className="ap-sync-btn"
                disabled={busy}
                onClick={() => onChoose('merge')}
              >
                {CHOICE_LABEL.merge}
              </button>
              <button
                type="button"
                className="ap-sync-btn ghost"
                disabled={busy}
                onClick={() => onChoose('account')}
              >
                {CHOICE_LABEL.account}
              </button>
              <button
                type="button"
                className="ap-sync-btn ghost"
                disabled={busy}
                onClick={() => onChoose('device')}
              >
                {CHOICE_LABEL.device}
              </button>
            </div>
          )}
          {failed && (
            <p className="ap-sync-warn" role="alert">
              Não deu certo. Tente de novo.
            </p>
          )}
        </div>
      </div>
    );
  }
  const text = SYNC_STRIP[sync];
  if (!text) {
    // Internet de volta: um aviso curto, sem ícone (o problema acabou).
    if (!recovered || !showToast) return null;
    return (
      <div className="ap-net">
        <p className="ap-net-toast is-ok" role="status">
          {SYNC_BACK}
        </p>
      </div>
    );
  }
  const kind = sync as 'offline' | 'error' | 'signed-out';
  return (
    <div className="ap-net">
      <button type="button" className={`ap-net-ic is-${kind}`} aria-label={text} onClick={onReveal}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d={NET_ICON[kind]} />
        </svg>
      </button>
      {showToast && (
        <p className="ap-net-toast" role="status">
          {text}
        </p>
      )}
    </div>
  );
}

interface Props {
  saves: SyncedSaveStore;
  slot: SaveSlot;
  /** Chamado antes de aplicar a escolha: quem monta a tela desmonta a partida para ela não regravar por cima. */
  onBeforeResolve: () => void;
  /** A escolha trocou o estado do jogo: quem monta a tela recarrega a partida com ele. */
  onResolved: () => void;
}

/** Liga o aviso ao store: acompanha o estado da sincronização e resolve o conflito. */
export function SyncNotice({ saves, slot, onBeforeResolve, onResolved }: Props) {
  const [sync, setSync] = useState<SyncState>(() => saves.sync(slot));
  const [conflict, setConflict] = useState<Conflict | null>(() => saves.conflict(slot));
  const [confirming, setConfirming] = useState<ConflictChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showToast, setShowToast] = useState(true);
  const [recovered, setRecovered] = useState(false);
  const wasBad = useRef(SYNC_STRIP[saves.sync(slot)] !== undefined);

  // O aviso de texto aparece quando o estado muda e some sozinho; ao voltar a internet avisa de novo, curto.
  useEffect(() => {
    if (SYNC_STRIP[sync] !== undefined) {
      setRecovered(false);
      setShowToast(true);
      wasBad.current = true;
    } else if (sync !== 'conflict') {
      if (wasBad.current) {
        setRecovered(true);
        setShowToast(true);
      }
      wasBad.current = false;
    }
  }, [sync]);
  useEffect(() => {
    if (!showToast) return;
    const bad = SYNC_STRIP[sync] !== undefined;
    if (!bad && !recovered) return;
    const id = window.setTimeout(
      () => {
        setShowToast(false);
        if (!bad) setRecovered(false);
      },
      bad ? TOAST_MS.problem : TOAST_MS.back,
    );
    return () => window.clearTimeout(id);
  }, [showToast, sync, recovered]);

  useEffect(() => {
    const read = () => {
      setSync(saves.sync(slot));
      setConflict(saves.conflict(slot));
    };
    read();
    return saves.subscribe((e) => {
      if (e.slot === slot) read();
    });
  }, [saves, slot]);

  async function choose(choice: ConflictChoice) {
    // Quem descarta algo pede o segundo passo; juntar não perde nada.
    if (choice !== 'merge' && confirming !== choice) {
      setConfirming(choice);
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      onBeforeResolve();
      await saves.resolveConflict(slot, choice);
      setConfirming(null);
      onResolved();
    } catch {
      setFailed(true);
      onResolved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <SyncView
      sync={sync}
      conflict={conflict}
      confirming={confirming}
      busy={busy}
      failed={failed}
      onChoose={(c) => void choose(c)}
      onCancel={() => setConfirming(null)}
      showToast={showToast}
      recovered={recovered}
      onReveal={() => setShowToast(true)}
    />
  );
}
