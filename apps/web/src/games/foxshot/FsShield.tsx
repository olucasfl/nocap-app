/** Invencibilidade de quem nasce no mata-mata: borda azul pulsando e uma barra que esvazia (só transform e opacity). */
export function FsShield({ frac }: { frac: number }) {
  return (
    <div className="fs-shield" data-testid="fs-shield" aria-live="polite">
      <div className="fs-shield-edge" />
      <div className="fs-shield-tag">
        <b>Invencível</b>
        <span>Se mover ou atirar, a proteção acaba</span>
        <i>
          <u style={{ transform: `scaleX(${Math.max(0, Math.min(1, frac))})` }} />
        </i>
      </div>
    </div>
  );
}
