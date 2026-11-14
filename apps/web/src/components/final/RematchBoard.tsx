import type { ReactNode } from 'react';
import './rematch-board.css';

export interface RematchPlayer {
  id: string;
  name: string;
  /** O desenho da pessoa (bolinha, raposa...), no tamanho que couber no círculo. */
  avatar: ReactNode;
  connected: boolean;
  rematch: boolean;
  me?: boolean;
}

/**
 * "Quem quer jogar de novo", em imagem: cada pessoa num cartão com o seu desenho e, embaixo, ou a faixa verde "QUER JOGAR DE
 * NOVO" (com o visto), ou a cinza "AINDA NÃO CLICOU" (com pontinhos), ou "SAIU". Serve de pódio de revanche em qualquer jogo;
 * as cores vêm do jogo (variáveis `--rmb-*`). Só `transform` e `opacity` se mexem.
 */
export function RematchBoard({ players }: { players: RematchPlayer[] }) {
  return (
    <ul className="rmb" aria-label="Quem quer jogar de novo" data-testid="rematch-board">
      {players.map((p) => {
        const state = !p.connected ? 'off' : p.rematch ? 'yes' : 'wait';
        return (
          <li key={p.id} className={`rmb-p${p.me ? ' me' : ''}`} data-state={state} data-testid={`rematch-${p.id}`}>
            <span className="rmb-av" aria-hidden="true">{p.avatar}</span>
            <b className="rmb-name">{p.name}{p.me ? ' (você)' : ''}</b>
            <span className="rmb-tag" role="status">
              {state === 'yes' && (
                <>
                  <svg className="rmb-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  <span>Quer jogar de novo</span>
                </>
              )}
              {state === 'wait' && (
                <>
                  <span>Ainda não clicou</span>
                  <span className="rmb-dots" aria-hidden="true"><i /><i /><i /></span>
                </>
              )}
              {state === 'off' && <span>Saiu</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
