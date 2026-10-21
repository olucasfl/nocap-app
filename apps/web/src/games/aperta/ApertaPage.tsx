import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Sky } from './art';
import { SavesModal } from './SavesModal';
import { afterPick, apertaAccess } from './saves-flow';
import { createApiSaveStore } from './api-save-store';
import type { SaveSummary } from './save-store';
import { StoryScreen } from './StoryScreen';
import { TitleScreen } from './TitleScreen';
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
  | { name: 'wip'; save: SaveSummary };

/** A rota /arcade/aperta: título, saves, história e, por enquanto, a tela provisória do jogo. */
export function ApertaPage() {
  useSpaceFonts();
  const { user, status } = useAuth();
  const access = apertaAccess(status, !!user);
  const userId = user?.id;
  const store = useMemo(() => (userId ? createApiSaveStore(userId) : null), [userId]);
  const [screen, setScreen] = useState<Screen>({ name: 'title', saves: false });

  function pick(save: SaveSummary) {
    setScreen(
      afterPick(save.storySeen) === 'story' ? { name: 'story', save } : { name: 'wip', save },
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
            setScreen({ name: 'wip', save: { ...screen.save, storySeen: true } });
          }}
        />
      )}
      {screen.name === 'wip' && (
        <section className="ap-wip" aria-label="Em construção">
          <h1>Em construção</h1>
          <p className="ap-sub">
            {screen.save.name} está salva. A tela de jogo chega na próxima etapa.
          </p>
          <button
            type="button"
            className="ap-btn"
            autoFocus
            onClick={() => setScreen({ name: 'title', saves: false })}
          >
            Voltar
          </button>
        </section>
      )}
    </main>
  );
}
