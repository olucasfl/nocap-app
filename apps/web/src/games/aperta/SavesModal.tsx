import { apertaSfx } from '@/lib/aperta-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { askDelete, backOrClose, cancelDelete, savesModalStart } from './saves-flow';
import {
  playedAgo,
  RECOVERY_DAYS,
  saveStats,
  type SaveSlot,
  type SaveStore,
  type SaveSummary,
} from './save-store';
import { useDialog } from './useDialog';

interface Props {
  store: SaveStore;
  onClose: () => void;
  /** `fresh`: o save acabou de ser criado. */
  onPick: (save: SaveSummary, fresh: boolean) => void;
}

/** "Escolha um jogo salvo": 2 espaços, novo jogo, continuar e apagar em 2 passos (spec 038, 3.2). */
export function SavesModal({ store, onClose, onPick }: Props) {
  const [saves, setSaves] = useState<(SaveSummary | null)[] | null>(null);
  const [flow, setFlow] = useState(savesModalStart);
  const [notice, setNotice] = useState<{ text: string; undo?: SaveSlot } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const card = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    try {
      setSaves(await store.list());
    } catch {
      setError('Não deu para carregar seus saves. Tente de novo.');
      setSaves([null, null]);
    }
  }, [store]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const back = () => {
    const next = backOrClose(flow);
    setFlow(next.state);
    if (next.close) onClose();
  };
  useDialog(card, back);

  async function run(job: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await job();
    } catch {
      setError('Algo deu errado. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  const create = (slot: SaveSlot) =>
    run(async () => {
      const save = await store.create(slot);
      apertaSfx.thunk();
      onPick(save, true);
    });

  const confirmDelete = (slot: SaveSlot) =>
    run(async () => {
      await store.remove(slot);
      apertaSfx.boing();
      setFlow(cancelDelete());
      setNotice({
        text: `Save ${slot} apagado. Dá para recuperar em até ${RECOVERY_DAYS} dias.`,
        undo: slot,
      });
      await reload();
    });

  const undo = (slot: SaveSlot) =>
    run(async () => {
      const restored = await store.restore(slot);
      if (restored) apertaSfx.flip();
      setNotice(
        restored
          ? { text: `Save ${slot} de volta.` }
          : { text: 'Não deu para recuperar: o prazo passou.' },
      );
      await reload();
    });

  return (
    <div className="ap-modal" onMouseDown={(e) => e.target === e.currentTarget && back()}>
      <div
        ref={card}
        className="ap-mcard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-saves-title"
      >
        <h2 id="ap-saves-title">Escolha um jogo salvo</h2>
        <p className="ap-sub">Você pode ter até dois saves ao mesmo tempo.</p>

        {error && (
          <p className="ap-notice ap-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="ap-notice" role="status">
            <span>{notice.text}</span>
            {notice.undo && (
              <button
                type="button"
                className="ap-btn ghost small"
                disabled={busy}
                onClick={() => undo(notice.undo!)}
              >
                Desfazer
              </button>
            )}
          </p>
        )}

        <div className="ap-slots">
          {([1, 2] as const).map((slot) => {
            const save = saves?.[slot - 1] ?? null;
            if (!saves) {
              return (
                <div key={slot} className="ap-slot" aria-busy="true">
                  <p className="ap-slot-n">Save {slot}</p>
                  <p>Carregando...</p>
                </div>
              );
            }
            if (!save) {
              return (
                <div key={slot} className="ap-slot">
                  <p className="ap-slot-n">Save {slot}</p>
                  <h3>Espaço vazio</h3>
                  <p>Comece uma nova missão do zero.</p>
                  <div className="ap-row">
                    <button
                      type="button"
                      className="ap-btn small"
                      disabled={busy}
                      onClick={() => create(slot)}
                    >
                      Novo jogo
                    </button>
                  </div>
                </div>
              );
            }
            if (flow.confirmingDelete === slot) {
              return (
                <div key={slot} className="ap-slot confirm" role="group" aria-label={`Apagar save ${slot}`}>
                  <p className="ap-slot-n">Save {slot}</p>
                  <h3>Apagar {save.name}?</h3>
                  <p>
                    Todo o progresso some, mas você pode recuperar em até {RECOVERY_DAYS} dias.
                  </p>
                  <div className="ap-row">
                    <button
                      type="button"
                      className="ap-btn red small"
                      disabled={busy}
                      onClick={() => confirmDelete(slot)}
                    >
                      Sim, apagar
                    </button>
                    <button
                      type="button"
                      className="ap-btn ghost small"
                      onClick={() => setFlow(cancelDelete())}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={slot} className="ap-slot">
                <p className="ap-slot-n">Save {slot}</p>
                <h3>{save.name}</h3>
                <p>{saveStats(save)}</p>
                <p>{playedAgo(save.lastPlayedAt)}</p>
                <div className="ap-row">
                  <button
                    type="button"
                    className="ap-btn small"
                    disabled={busy}
                    onClick={() => {
                      apertaSfx.thunk();
                      onPick(save, false);
                    }}
                  >
                    Continuar
                  </button>
                  <button
                    type="button"
                    className="ap-btn ghost small"
                    disabled={busy}
                    onClick={() => setFlow(askDelete(flow, slot))}
                  >
                    Apagar
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="ap-row">
          <button type="button" className="ap-btn ghost small" onClick={back}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
