import { apertaSfx } from '@/lib/aperta-audio';
import { useState } from 'react';
import { StoryScene } from './art';
import { STORY, storyButton, storyNext, storySkip, storyStart } from './story';

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
        <StoryScene index={state.index} />
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
