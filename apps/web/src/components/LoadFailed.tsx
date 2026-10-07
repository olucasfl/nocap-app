import { useOnline } from '@/lib/network';
import { WifiOff } from './icons';
import './network.css';

/**
 * "Não deu para carregar": sem internet, explica que é a conexão (e que o resto do app segue
 * funcionando); com internet, é o servidor. Sempre com um botão de tentar de novo.
 */
export function LoadFailed({
  what,
  onRetry,
  offlineText,
}: {
  /** O que não carregou, em minúsculas ("o ranking", "seus amigos"). */
  what: string;
  onRetry?: () => void;
  /** Frase extra quando offline (o que dá para fazer sem internet). */
  offlineText?: string;
}) {
  const online = useOnline();
  return (
    <section className="lf" role="alert">
      <div className="lf-icon">
        <WifiOff size={24} />
      </div>
      <h2 className="lf-title">{online ? 'Não deu para carregar' : 'Você está sem internet'}</h2>
      <p className="lf-text">
        {online
          ? `Não conseguimos carregar ${what} agora. Tente de novo em instantes.`
          : `Sem conexão não dá para carregar ${what}. ${offlineText ?? 'Assim que a internet voltar, tente de novo.'}`}
      </p>
      {onRetry && (
        <button type="button" className="btn ghost" onClick={onRetry}>
          Tentar de novo
        </button>
      )}
    </section>
  );
}
