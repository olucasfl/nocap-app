import { Link } from '@tanstack/react-router';
import { ArrowLeft } from './icons';
import './back-button.css';

/**
 * Botão de voltar das telas internas. Sem `onClick`, leva a um destino fixo (previsível, sem
 * depender do histórico); com `onClick`, é um botão que só troca a tela de dentro da própria rota.
 */
export function BackButton({
  to = '/',
  label = 'Voltar',
  onClick,
}: {
  to?: string;
  label?: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button type="button" className="bb" data-sfx="back" onClick={onClick}>
        <ArrowLeft size={18} />
        {label}
      </button>
    );
  }
  return (
    <Link to={to} className="bb" data-sfx="back">
      <ArrowLeft size={18} />
      {label}
    </Link>
  );
}
