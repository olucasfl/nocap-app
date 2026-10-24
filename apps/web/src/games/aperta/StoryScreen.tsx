import { apertaSfx } from '@/lib/aperta-audio';
import { useState } from 'react';
import { StoryArt } from './StoryArt';
import { STORY, STORY_KICKER, STORY_SUB, storyButton, storyNext, storySkip, storyStart } from './story';

/** A abertura de 4 cenas, só no primeiro jogo de cada save (spec 038, 3.3; cenas novas na spec 042, adendo). */
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
        {/* A chave refaz a cena: as animações de entrada rodam a cada tela. */}
        <div key={`s${state.index}`} className="st-stage">
          <StoryArt index={state.index} />
        </div>
        <div className="st-copy">
          <p key={`k${state.index}`} className="ap-story-k">
            {STORY_KICKER[state.index]}
          </p>
          <h2 key={`t${state.index}`} className="ap-story-t" aria-live="polite">
            {STORY[state.index]}
          </h2>
          <p key={`u${state.index}`} className="ap-story-u">
            {STORY_SUB[state.index]}
          </p>
          <ol className="st-prog" aria-label={`Registro ${state.index + 1} de ${STORY.length}`}>
            {STORY.map((_, i) => (
              <li key={i} className={i === state.index ? 'on' : i < state.index ? 'done' : ''} />
            ))}
          </ol>
          <div className="st-actions">
            <button type="button" className="ap-btn" autoFocus onClick={() => apply(storyNext(state))}>
              {storyButton(state)}
            </button>
            <button type="button" className="ap-link" onClick={() => apply(storySkip(state))}>
              Pular história
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
