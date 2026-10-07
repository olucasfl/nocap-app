import './loader.css';

/**
 * Carregando, com a cara do NoCap: quatro amostras de cor pulam em sequência sob o logo.
 * Anima só `transform`; com movimento reduzido fica parado (as amostras seguem visíveis).
 * `inline` é a versão compacta para listas e abas.
 */
export function Loader({
  label = 'Carregando',
  inline = false,
}: {
  label?: string;
  inline?: boolean;
}) {
  return (
    <div className={`ld${inline ? ' inline' : ''}`} role="status" aria-live="polite">
      <div className="ld-mark" aria-hidden="true">
        no cap<span>!</span>
      </div>
      <div className="ld-dots" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <span className="mono ld-label">{label.toUpperCase()}</span>
    </div>
  );
}

/** Tela cheia, para a abertura do app e para telas carregadas sob demanda. */
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="ld-page">
      <Loader label={label} />
    </div>
  );
}
