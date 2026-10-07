import { Link } from '@tanstack/react-router';
import { ArrowLeft } from './icons';
import './back-button.css';

/** Botão de voltar das telas internas. Leva a um destino fixo (previsível, sem depender do histórico). */
export function BackButton({ to = '/', label = 'Voltar' }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="bb">
      <ArrowLeft size={18} />
      {label}
    </Link>
  );
}
