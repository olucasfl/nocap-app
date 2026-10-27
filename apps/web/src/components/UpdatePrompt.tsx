import { useEffect, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { router } from '@/router';
import { canShowUpdate } from '@/lib/update-gate';
import { appOutdated } from '@/lib/app-version';
import { useRoom } from '@/lib/rooms';
import { useUpdateNeeded } from '@/lib/update-state';
import { usePopupSlot } from '@/lib/popups';
import { hardReload } from '@/lib/hard-reload';
import './update-prompt.css';

/** De quanto em quanto tempo o app procura versão nova enquanto está aberto. */
const CHECK_EVERY_MS = 60_000;
/** Tentativas de atualizar nesta aba (zera depois de um tempo sem aviso): impede o "atualizando" sem fim. */
const TRIES_KEY = 'nocap-update-tries';
/** Se a atualização normal não recarregou a página neste tempo, força. */
const FORCE_AFTER_MS = 4000;
const CALM_AFTER_MS = 20_000;

const readTries = () => {
  try {
    return Number(sessionStorage.getItem(TRIES_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
};
const writeTries = (n: number | null) => {
  try {
    if (n === null) sessionStorage.removeItem(TRIES_KEY);
    else sessionStorage.setItem(TRIES_KEY, String(n));
  } catch {
    /* sem storage */
  }
};

/**
 * Versão nova: a tela fica travada por cima do app até a pessoa tocar em ATUALIZAR. Jogar com a
 * versão velha misturava regras (notas, modos) com as do servidor, então não há como fechar o
 * aviso. Mas ele só aparece quando não atrapalha (`canShowUpdate`): no meio de jogo, sala ou
 * pódio a versão nova espera, e o aviso surge quando a pessoa volta ao início, perfil etc.
 * Também procura versão nova a cada minuto e ao voltar para o app.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => undefined);
      };
      window.setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
  const [updating, setUpdating] = useState(false);
  // O service worker às vezes não avisa (celular com o app aberto há dias, aba presa): `/version.json` é buscado na rede
  // e diz se esta versão ainda é a mais nova. Confere ao abrir, ao voltar para o app e a cada minuto.
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = () => {
      void appOutdated().then((old) => alive && old && setStale(true));
    };
    check();
    const t = window.setInterval(check, CHECK_EVERY_MS);
    const vis = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', vis);
    return () => {
      alive = false;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  // uma partida em tela cheia aberta (Fut Fox, Desmorona!, Atravessa!): a versão nova espera ela acabar
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!needRefresh && !stale) return undefined;
    const look = () => setPlaying(!!document.querySelector('.dsm-play, .at-play'));
    look();
    const t = window.setInterval(look, 800);
    return () => window.clearInterval(t);
  }, [needRefresh, stale]);
  // um tempo sem aviso de versão nova: a atualização deu certo, zera a conta de tentativas
  useEffect(() => {
    if (needRefresh) return;
    const t = window.setTimeout(() => writeTries(null), CALM_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [needRefresh]);
  const apply = () => {
    setUpdating(true);
    const tries = readTries();
    writeTries(tries + 1);
    // a segunda tentativa seguida já vai direto à força; a primeira tenta o jeito normal e, se a
    // página não recarregar, força depois de alguns segundos
    if (tries >= 1 || !needRefresh) return void hardReload();
    void updateServiceWorker(true);
    window.setTimeout(() => void hardReload(), FORCE_AFTER_MS);
  };
  const pathname = useRouterState({ router, select: (s) => s.location.pathname });
  const inRoom = useRoom((s) => s.snapshot !== null);
  const roomPhase = useRoom((s) => s.snapshot?.phase);
  useEffect(() => {
    useUpdateNeeded.setState({ needed: needRefresh || stale });
  }, [needRefresh, stale]);

  // as entradas dos jogos (Fox Cap!, Atravessa!) também valem: é de lá que se joga offline
  const gameHub = /^\/(fox-cap|atravessa)(\/|$)/.test(pathname) && !inRoom && !playing;
  const wanted = (needRefresh || stale) && (gameHub || canShowUpdate(pathname, inRoom, roomPhase));
  // O aviso de versão nova é o mais importante: vai antes de qualquer outro popup.
  const myTurn = usePopupSlot('update', wanted, 0);
  if (!wanted || !myTurn) return null;

  return (
    <div className="update-gate" role="alertdialog" aria-modal="true" aria-labelledby="up-title">
      <div className="update-card">
        <div className="mono update-tag">VERSÃO NOVA</div>
        <h2 id="up-title">Atualize para continuar</h2>
        <p className="mono">
          Saiu uma versão nova do NoCap. Toque em atualizar para voltar a jogar.
        </p>
        <button
          type="button"
          className="btn alt"
          data-sfx="start"
          disabled={updating}
          onClick={apply}
        >
          {updating ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>
    </div>
  );
}
