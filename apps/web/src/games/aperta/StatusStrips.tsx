import { CONTENT_KIND_LABEL, type EventView, type MissionView, type NewInSpaceView } from './content-logic';

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
export function MissionChip({ view }: { view: MissionView }) {
  return (
    <div className={`ap-chip ap-chip-mission${view.done ? ' is-done' : ''}`} role="status">
      <small>Missão da estação</small>
      <span>
        {view.done ? 'Cumprida: Fragmentos extras ao colapsar' : `${view.text} (${view.progress}/${view.target})`}
      </span>
    </div>
  );
}

/** Evento ativo (Chuva de meteoros, Tempestade solar). Sem cronômetro nem barra na tela. */
export function EventChip({ view }: { view: EventView }) {
  return (
    <div className={`ap-chip ap-chip-event ap-chip-${view.id}`} role="status">
      <b>{view.name}</b>
      <span>{view.text}</span>
    </div>
  );
}
