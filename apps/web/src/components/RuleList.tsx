import type { RuleCheck } from '@/lib/account-form';
import './rulelist.css';

/** O que pode e o que não pode: cada regra com o seu estado (cumprida ou não). */
export function RuleList({ title, rules }: { title: string; rules: RuleCheck[] }) {
  return (
    <div className="rl" aria-label={title}>
      <div className="mono rl-title">{title}</div>
      <ul>
        {rules.map((r) => (
          <li key={r.label} className={r.ok ? 'ok' : 'no'}>
            <span className="mono" aria-hidden="true">
              {r.ok ? 'OK' : 'X'}
            </span>
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
