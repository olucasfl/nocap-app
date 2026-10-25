import { LOW_END } from './perf';
import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from '@tanstack/react-router';
import { useApertaAllowed } from '@/lib/aperta-access';
import { useApertaFrame } from '@/lib/aperta-frame';
import { releaseOrientation, tryLockLandscape } from '@/lib/aperta-orientation';
import { useAuth } from '@/lib/auth';
import { Sky } from './art';
import { GameScreen } from './GameScreen';
import { createSyncedGameStore, type GameStore } from './game-store';
import { SavesModal } from './SavesModal';
import { afterPick, apertaAccess } from './saves-flow';
import { createApiSaveStore, type SyncedSaveStore } from './api-save-store';
import type { SaveSummary } from './save-store';
import { StoryScreen } from './StoryScreen';
import { SyncNotice } from './SyncNotice';
import { TitleScreen } from './TitleScreen';
import { useApertaGame } from './useApertaGame';
import './aperta.css';
import './story.css';
import './hud.css';
import './landscape.css';
import './fullpage.css';

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Space+Grotesk:wght@400;500;700&display=swap';

/** As fontes do tema espaço só baixam quando o Aperta! abre (o resto do app não paga por elas). */
function useSpaceFonts() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_HREF;
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
}

type Screen =
  | { name: 'title'; saves: boolean }
  | { name: 'story'; save: SaveSummary }
  | { name: 'game'; save: SaveSummary };

/**
 * A rota /arcade/aperta. Em teste, só a conta liberada pelo servidor entra: visitante e outras contas voltam para o início
 * (e o servidor também recusa os saves com 403).
 */
export function ApertaPage() {
  const allowed = useApertaAllowed();
  const navigate = useNavigate();
  useEffect(() => {
    if (allowed === false) void navigate({ to: '/', replace: true });
  }, [allowed, navigate]);
  const frame = useApertaFrame();
  if (allowed !== true) return <main className="ap space-theme" aria-busy={allowed === null} {...frame} />;
  return <ApertaGame />;
}

/** A rota /arcade/aperta liberada: título, saves, história e a tela de jogo. */
function ApertaGame() {
  useSpaceFonts();
  // Ao sair do Aperta! solta a trava de orientação (e a tela cheia, se o jogo a pediu).
  useEffect(() => releaseOrientation, []);
  const { user, status } = useAuth();
  const access = apertaAccess(status, !!user);
  const userId = user?.id;
  // Lista de saves e partida em curso vão para a API (etapa 2), com cópia local para jogar sem internet.
  const store = useMemo(() => (userId ? createApiSaveStore(userId) : null), [userId]);
  const gameStore = useMemo(() => (store ? createSyncedGameStore(store) : null), [store]);
  const [screen, setScreen] = useState<Screen>({ name: 'title', saves: false });
  const frame = useApertaFrame();

  function pick(save: SaveSummary) {
    setScreen(
      afterPick(save.storySeen) === 'story' ? { name: 'story', save } : { name: 'game', save },
    );
  }

  return (
    <main className={`ap space-theme${LOW_END ? ' is-lite' : ''}`} {...frame}>
      <Sky />
      {screen.name === 'title' && (
        <>
          <TitleScreen
            access={access}
            onPlay={() => {
              void tryLockLandscape();
              setScreen({ name: 'title', saves: true });
            }}
          />
          {screen.saves && store && (
            <SavesModal
              store={store}
              onClose={() => setScreen({ name: 'title', saves: false })}
              onPick={pick}
            />
          )}
        </>
      )}
      {screen.name === 'story' && (
        <StoryScreen
          onDone={() => {
            // A partida só abre depois da marca: se abrisse junto, leria a conta antes de a marca subir e a apagaria.
            const next = { name: 'game', save: { ...screen.save, storySeen: true } } as const;
            const marked = store?.markStorySeen(screen.save.slot) ?? Promise.resolve();
            void marked.catch(() => undefined).then(() => setScreen(next));
          }}
        />
      )}
      {screen.name === 'game' && gameStore && userId && (
        <GameLoader
          saves={store!}
          store={gameStore}
          save={screen.save}
          userId={userId}
          onExit={() => setScreen({ name: 'title', saves: false })}
        />
      )}
    </main>
  );
}

/**
 * Carrega o save do espaço e abre a tela de jogo, com o aviso de sincronização por cima. Ao resolver um
 * conflito entre aparelhos a partida é desmontada antes (o salvamento de saída do jogo velho não pode
 * passar por cima da escolha) e recarregada com o estado escolhido.
 */
function GameLoader({
  saves,
  store,
  save,
  userId,
  onExit,
}: {
  saves: SyncedSaveStore;
  store: GameStore;
  save: SaveSummary;
  userId: string;
  onExit: () => void;
}) {
  const [playing, setPlaying] = useState(true);
  const [epoch, setEpoch] = useState(0);
  return (
    <>
      {playing && <GamePlay key={epoch} store={store} save={save} userId={userId} onExit={onExit} />}
      <SyncNotice
        saves={saves}
        slot={save.slot}
        onBeforeResolve={() => flushSync(() => setPlaying(false))}
        onResolved={() => {
          setEpoch((e) => e + 1);
          setPlaying(true);
        }}
      />
    </>
  );
}

function GamePlay({
  store,
  save,
  userId,
  onExit,
}: {
  store: GameStore;
  save: SaveSummary;
  userId: string;
  onExit: () => void;
}) {
  const seed = `${userId}:${save.slot}:${save.lastPlayedAt}`;
  const load = useApertaGame({ store, slot: save.slot, seed, name: save.name });
  if (load.status === 'ready') return <GameScreen controller={load.controller} onExit={onExit} />;
  return (
    <section className="ap-wip" aria-label={load.status === 'error' ? 'Erro ao carregar' : 'Carregando'}>
      <h1>{load.status === 'error' ? 'Não carregou' : 'Carregando'}</h1>
      {load.status === 'error' && (
        <>
          <p className="ap-sub">Não deu para abrir {save.name}. Tente de novo.</p>
          <button type="button" className="ap-btn" autoFocus onClick={onExit}>
            Voltar
          </button>
        </>
      )}
    </section>
  );
}
