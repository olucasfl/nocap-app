import { useEffect, useState, useSyncExternalStore } from 'react';
import { createGameController, loadOrCreate, type GameController } from './game-controller';
import type { GameStore } from './game-store';
import type { SaveSlot } from './save-store';

const TICK_MS = 250;
/** Autosave a cada 30 s (spec 038, 10.4); escolher grimório e esconder a aba salvam na hora. */
export const AUTOSAVE_MS = 30_000;

interface Options {
  store: GameStore;
  slot: SaveSlot;
  /** Semente do sorteio de um save novo. */
  seed: string;
  name: string;
}

export type GameLoad =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; controller: GameController };

/** Carrega o save do espaço (ou cria a partida) e entrega o controlador já ligado ao relógio. */
export function useApertaGame({ store, slot, seed, name }: Options): GameLoad {
  const [load, setLoad] = useState<GameLoad>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    setLoad({ status: 'loading' });
    loadOrCreate(store, slot, seed, name)
      .then((initial) => {
        if (alive) setLoad({ status: 'ready', controller: createGameController({ initial, store, slot }) });
      })
      .catch(() => {
        if (alive) setLoad({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [store, slot, seed, name]);

  const controller = load.status === 'ready' ? load.controller : null;
  useEffect(() => {
    if (!controller) return;
    return runController(controller);
  }, [controller]);

  return load;
}

/**
 * Relógio, autosave e pausa do controlador. O relógio pausa com a aba escondida (spec 7.4); o save
 * sai ao esconder, ao fechar a página e ao desmontar a tela.
 */
export function runController(ctl: GameController): () => void {
  if (document.visibilityState === 'hidden') ctl.pause();
  const tick = window.setInterval(() => ctl.tick(), TICK_MS);
  const autosave = window.setInterval(() => void ctl.save(), AUTOSAVE_MS);
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') ctl.pause();
    else ctl.resume();
  };
  const onPageHide = () => void ctl.save();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  return () => {
    window.clearInterval(tick);
    window.clearInterval(autosave);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    void ctl.save();
  };
}

export function useGameSnapshot(ctl: GameController) {
  return useSyncExternalStore(ctl.subscribe, ctl.getSnapshot, ctl.getSnapshot);
}
