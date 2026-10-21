import { useEffect, useRef, useState } from 'react';
import type { Conflict, ConflictChoice, SyncedSaveStore, SyncState } from './api-save-store';
import type { SaveSlot } from './save-store';
import { useDialog } from './useDialog';
import './sync-notice.css';

/** Avisos de uma linha para o que não trava o jogo (spec 038, 10.4). `saved` e `saving` não mostram nada. */
export const SYNC_STRIP: Partial<Record<SyncState, string>> = {
  offline: 'Sem conexão com a conta. Você segue jogando e o progresso sobe quando a internet voltar.',
  error: 'Não deu para salvar na conta. O progresso fica neste aparelho e a gente tenta de novo.',
  'signed-out': 'Sua sessão acabou. Entre de novo para continuar salvando na conta.',
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
}

/** Só a aparência: faixa de aviso ou o diálogo "Este save mudou em outro aparelho". */
export function SyncView({ sync, conflict, confirming, busy, failed, onChoose, onCancel }: ViewProps) {
  const root = useRef<HTMLDivElement>(null);
  useDialog(root, () => {});
  if (conflict) {
    const needsConfirm = confirming && confirming !== 'merge' ? confirming : null;
    return (
      <div className="ap-sync-wrap">
        <div ref={root} className="ap-sync-card" role="alertdialog" aria-modal="true" aria-labelledby="ap-sync-title" tabIndex={-1}>
          <h2 id="ap-sync-title">Este save mudou em outro aparelho</h2>
          <p className="ap-sync-sub">
            Na conta: {lives(conflict.account.collapses)}. Neste aparelho: {lives(conflict.local.collapses)}. Nada foi
            sobrescrito. Escolha como seguir.
          </p>
          {needsConfirm ? (
            <>
              <p className="ap-sync-warn">{CONFIRM_TEXT[needsConfirm]}</p>
              <div className="ap-sync-row">
                <button type="button" className="ap-sync-btn danger" disabled={busy} onClick={() => onChoose(needsConfirm)}>
                  Sim, {CHOICE_LABEL[needsConfirm].toLowerCase()}
                </button>
                <button type="button" className="ap-sync-btn ghost" disabled={busy} onClick={onCancel}>
                  Voltar
                </button>
              </div>
            </>
          ) : (
            <div className="ap-sync-col">
              <button type="button" className="ap-sync-btn" disabled={busy} onClick={() => onChoose('merge')}>
                {CHOICE_LABEL.merge}
              </button>
              <button type="button" className="ap-sync-btn ghost" disabled={busy} onClick={() => onChoose('account')}>
                {CHOICE_LABEL.account}
              </button>
              <button type="button" className="ap-sync-btn ghost" disabled={busy} onClick={() => onChoose('device')}>
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
  if (!text) return null;
  return (
    <p className="ap-sync-strip" role="status">
      {text}
    </p>
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
    />
  );
}
