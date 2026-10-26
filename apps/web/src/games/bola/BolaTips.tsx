import { useEffect, useState, type ReactNode } from 'react';
import { IcCamera, IcGear, IcJump, Key } from './BolaIcons';

const KEY = 'nocap-bola-tips';
const seen = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/** Controles do jogo, mostrados uma vez só (na primeira partida) por cima da contagem. */
export function BolaTips({ touch }: { touch: boolean }) {
  const [open, setOpen] = useState(() => !seen());
  useEffect(() => {
    if (!open) return undefined;
    // some sozinha depois de um tempo, mas só "vale como vista" quando a pessoa toca em Entendi
    const t = window.setTimeout(() => setOpen(false), 20_000);
    return () => window.clearTimeout(t);
  }, [open]);
  if (!open) return null;
  const done = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* sem armazenamento: aparece de novo na próxima, sem problema */
    }
    setOpen(false);
  };
  const rows: { keys: ReactNode; text: string }[] = touch
    ? [
        {
          keys: <b className="bola-tip-tag">Joystick</b>,
          text: 'Arraste na metade esquerda para mover',
        },
        { keys: <IcJump size={20} />, text: 'Toque em Pular; de novo no ar, pulo duplo' },
        {
          keys: <b className="bola-tip-tag">Mortal</b>,
          text: 'Pule duas vezes mexendo o joystick: o mortal chuta a bola',
        },
        {
          keys: <IcCamera size={20} />,
          text: 'A câmera começa solta; o botão prende na bola e solta de novo',
        },
        { keys: <IcGear size={20} />, text: 'Config.: tabela, trocar de time, espectar e sair' },
      ]
    : [
        {
          keys: (
            <>
              <Key k="W" />
              <Key k="A" />
              <Key k="S" />
              <Key k="D" />
            </>
          ),
          text: 'Mover a raposa',
        },
        { keys: <Key k="Espaço" wide />, text: 'Pular; de novo no ar, pulo duplo' },
        {
          keys: (
            <>
              <Key k="Espaço" wide />
              <b className="bola-tip-plus">2x</b>
            </>
          ),
          text: 'Com uma direção apertada vira o mortal, que chuta a bola',
        },
        { keys: <Key k="F" />, text: 'Prende a câmera na bola ou solta' },
        { keys: <Key k="Tab" />, text: 'Segure para ver a tabela de estatísticas' },
        { keys: <Key k="Esc" />, text: 'Configurações (times, espectar, sair)' },
        {
          keys: (
            <>
              <Key k="Q" />
              <Key k="E" />
            </>
          ),
          text: 'Espectando: troca quem você acompanha (jogadores e a bola)',
        },
      ];
  return (
    <div className="bola-tips" role="dialog" aria-label="Como jogar" data-testid="bola-tips">
      <h2>Como jogar</h2>
      <ul>
        {rows.map((r, i) => (
          <li key={i}>
            <span className="bola-tip-keys">{r.keys}</span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="dsm-btn" onClick={done} data-testid="bola-tips-ok">
        Entendi
      </button>
    </div>
  );
}
