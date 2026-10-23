import { CONTENT_KIND_LABEL, type EventView, type MissionView, type NewInSpaceView, type RadarView } from './content-logic';

/** Faixa "Novo no espaço": o que o colapso trouxe, até a pessoa dispensar (spec 038, 5.4). */
export function NewInSpace({ view, onDismiss }: { view: NewInSpaceView; onDismiss: () => void }) {
  return (
    <section className="ap-newstrip" role="status" aria-label="Novo no espaço">
      <header>
        <b>Novo no espaço</b>
        <button type="button" className="ap-hbtn" onClick={onDismiss}>
          Entendi
        </button>
      </header>
      <ul>
        {view.items.map((item) => (
          <li key={`${item.kind}-${item.id}`} className={`ap-new-${item.kind}`} title={item.text}>
            <small>{CONTENT_KIND_LABEL[item.kind]}</small>
            <span>{item.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Missão da estação: uma por vida, com a contagem (a contagem é de progresso, não de tempo). */
/** Radar de lendários (árvore): uma barra que enche com as capturas; ao encher, o lendário nasce. Sem número. */
export function RadarChip({ view }: { view: RadarView }) {
  return (
    <div className="ap-chip ap-chip-radar" role="status" aria-label={`Radar de lendários: ${view.captures} de ${view.threshold} capturas`}>
      <small>Radar de lendários</small>
      <span className="ap-radar-track" aria-hidden="true">
        <i style={{ transform: `scaleX(${view.fill.toFixed(3)})` }} />
      </span>
    </div>
  );
}

export function MissionChip({ view }: { view: MissionView }) {
  return (
    <div className={`ap-chip ap-chip-mission${view.done ? ' is-done' : ''}`} role="status">
      <small>Missão da estação</small>
      <span>
        {view.done ? 'Missão cumprida' : `${view.text} (${view.progress}/${view.target})`}
      </span>
    </div>
  );
}

/** Evento ativo: o nome, o que faz e uma barra que encolhe (por `transform`) com o tempo que resta; sem número. */
export function EventChip({ view }: { view: EventView }) {
  return (
    <div className={`ap-chip ap-chip-event ap-chip-${view.id}`} role="status">
      <b>
        <EventIcon id={view.id} /> {view.name}
      </b>
      <span>{view.text}</span>
      {/* Tempo que resta: uma barra que encolhe por `transform` (sem número). Reinicia a cada evento. */}
      <i className="ap-chip-bar" aria-hidden="true" style={{ animationDuration: `${view.remaining.toFixed(1)}s` }} />
    </div>
  );
}

const EVENT_ICON: Record<string, string> = {
  'meteor-shower': 'M4 4l8 8M9 3l9 9M3 10l7 7M16 14l5 5M13 17l2 2',
  'solar-storm': 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  'gold-rain': 'M12 3v4M7 6l2 3M17 6l-2 3M5 14h14M8 18h8M10 21h4',
  alignment: 'M3 12h18M6 8h12M6 16h12M12 3v18',
  'energy-tide': 'M3 15c3-4 6-4 9 0s6 4 9 0M3 9c3-4 6-4 9 0s6 4 9 0',
  eclipse: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM16 6a7 7 0 0 1 0 12',
};

/** Ícone de traço do evento (sem emoji), decorativo: o nome já está no texto do chip. */
export function EventIcon({ id }: { id: string }) {
  return (
    <svg className="ap-chip-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={EVENT_ICON[id] ?? EVENT_ICON['solar-storm']} />
    </svg>
  );
}

const STREAKS = [8, 22, 36, 51, 64, 79, 92];
const STREAKS_LITE = [14, 45, 78];

/**
 * Arte do evento sobre o campo: riscos de meteoros caindo ou uma luz quente que pulsa. Só `transform`
 * e `opacity`, `pointer-events: none` (nunca atrapalha o toque) e menos riscos em aparelho fraco.
 */
export function EventFx({ id, lite }: { id: string; lite: boolean }) {
  if (id === 'meteor-shower') {
    return (
      <div className="ap-evfx ap-evfx-shower" aria-hidden="true">
        {(lite ? STREAKS_LITE : STREAKS).map((x, i) => (
          <i key={x} style={{ left: `${x}%`, animationDelay: `${(i * 0.37) % 1.6}s`, animationDuration: `${1.1 + (i % 3) * 0.3}s` }} />
        ))}
      </div>
    );
  }
  if (id === 'gold-rain' || id === 'alignment' || id === 'energy-tide' || id === 'eclipse') {
    return <div className={`ap-evfx ap-evfx-glow ap-evfx-${id}`} aria-hidden="true" />;
  }
  return <div className="ap-evfx ap-evfx-storm" aria-hidden="true" />;
}
