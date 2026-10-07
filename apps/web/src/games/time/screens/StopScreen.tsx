interface Props {
  /** Recebe o instante do toque (`performance.now()`), para a medição não depender de renderização. */
  onStop: (now: number) => void;
}

/**
 * A tela da contagem (regra central do Tempo, RULES.md): nenhum número, barra, animação,
 * som ou vibração. Não usa `.btn` (que toca o "clack" global) nem a animação de entrada de
 * `.screen`; o texto é fixo e a página inteira é a área de toque.
 */
export function StopScreen({ onStop }: Props) {
  return (
    <button
      type="button"
      className="tm-stop"
      onPointerDown={() => onStop(performance.now())}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onStop(performance.now());
        }
      }}
    >
      <span className="tm-stop-text">Conte de cabeça</span>
      <span className="tm-stop-hint">Toque em qualquer lugar para parar</span>
    </button>
  );
}
