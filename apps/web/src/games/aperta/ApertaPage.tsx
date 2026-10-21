import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Sky } from './art';
import { GameScreen } from './GameScreen';
import { createSyncedGameStore, type GameStore } from './game-store';
import { SavesModal } from './SavesModal';
import { afterPick, apertaAccess } from './saves-flow';
import { createApiSaveStore } from './api-save-store';
import type { SaveSummary } from './save-store';
import { StoryScreen } from './StoryScreen';
import { TitleScreen } from './TitleScreen';
import { useApertaGame } from './useApertaGame';
import './aperta.css';

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

/** A rota /arcade/aperta: título, saves, história e a tela de jogo. */
export function ApertaPage() {
  useSpaceFonts();
  const { user, status } = useAuth();
  const access = apertaAccess(status, !!user);
  const userId = user?.id;
  // Os saves vão para a API (etapa 2); o estado da partida em curso ainda usa o store local até as etapas seguintes.
  const store = useMemo(() => (userId ? createApiSaveStore(userId) : null), [userId]);
  const gameStore = useMemo(() => (store ? createSyncedGameStore(store) : null), [store]);
  const [screen, setScreen] = useState<Screen>({ name: 'title', saves: false });

  function pick(save: SaveSummary) {
    setScreen(
      afterPick(save.storySeen) === 'story' ? { name: 'story', save } : { name: 'game', save },
    );
  }

  return (
    <main className="ap">
      <Sky />
      {screen.name === 'title' && (
        <>
          <TitleScreen access={access} onPlay={() => setScreen({ name: 'title', saves: true })} />
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
            void store?.markStorySeen(screen.save.slot);
            setScreen({ name: 'game', save: { ...screen.save, storySeen: true } });
          }}
        />
      )}
      {screen.name === 'game' && gameStore && userId && (
        <GameLoader
          store={gameStore}
          save={screen.save}
          userId={userId}
          onExit={() => setScreen({ name: 'title', saves: false })}
        />
      )}
    </main>
  );
}

/** Carrega o save do espaço e abre a tela de jogo. */
function GameLoader({
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
