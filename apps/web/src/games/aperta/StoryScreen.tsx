import { apertaSfx } from '@/lib/aperta-audio';
import { GRIMOIRES } from '@nocap/games';
import { useState } from 'react';
import { StoryScene } from './art';
import { GrimoireBook } from './GrimoireBook';
import { SpaceArtSprite } from './SpaceArtSprite';
import { artRarity, astroFor } from './game-logic';
import { STORY, storyButton, storyNext, storySkip, storyStart } from './story';

/** Os livros da última tela: um comum, um raro e um épico do catálogo, os mesmos das cartas de grimório. */
const STORY_BOOKS = (
  [
    ['moon', 'common'],
    ['venus', 'rare'],
    ['sirius', 'epic'],
  ] as const
).flatMap(([id, rarity]) => {
  const def = GRIMOIRES.find((g) => g.id === id);
  return def ? [{ def, rarity }] : [];
});

function StoryBooks() {
  return (
    <div className="ap-scene ap-story-books" aria-hidden="true">
      {/* As medalhas dos livros vêm do sprite de astros, que a tela de jogo monta mas a história não. */}
      <SpaceArtSprite />
      {STORY_BOOKS.map(({ def, rarity }) => (
        <GrimoireBook key={def.id} rarity={artRarity(rarity)} astro={astroFor(def.id, def.family)} name={def.name} size="md" still />
      ))}
    </div>
  );
}

/** A história de 4 telas, só no primeiro jogo de cada save (spec 038, 3.3). */
export function StoryScreen({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState(storyStart);

  const apply = (next: typeof state) => {
    setState(next);
    if (next.done) {
      apertaSfx.thunk();
      onDone();
    } else {
      apertaSfx.flip();
    }
  };

  return (
    <section className="ap-story ap-screen-in" aria-label="História">
      <div className="ap-story-box">
        {state.index === STORY.length - 1 ? <StoryBooks /> : <StoryScene index={state.index} />}
        <p className="ap-story-k">
          Registro {state.index + 1} de {STORY.length}
        </p>
        {/* A chave refaz o texto: a animação de subida roda a cada tela. */}
        <p key={state.index} className="ap-story-t" aria-live="polite">
          {STORY[state.index]}
        </p>
        <ol className="ap-dots" aria-hidden="true">
          {STORY.map((_, i) => (
            <li key={i} className={i === state.index ? 'on' : ''} />
          ))}
        </ol>
        <button type="button" className="ap-btn" autoFocus onClick={() => apply(storyNext(state))}>
          {storyButton(state)}
        </button>
        <button type="button" className="ap-link" onClick={() => apply(storySkip(state))}>
          Pular história
        </button>
      </div>
    </section>
  );
}
