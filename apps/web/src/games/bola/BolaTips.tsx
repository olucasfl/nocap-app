import { useEffect, useState } from 'react';

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
  const rows: [string, string][] = touch
    ? [
        ['Joystick', 'Arraste na metade esquerda para mover'],
        ['Pular', 'Toque no botão; toque de novo no ar para o pulo duplo'],
        ['Mortal', 'Pule duas vezes mexendo o joystick: o mortal chuta a bola'],
        ['Câmera', 'O botão troca entre câmera na bola e livre'],
        ['Config.', 'Estatísticas, trocar de time, espectar e sair'],
      ]
    : [
        ['W A S D', 'Mover a raposa'],
        ['Espaço', 'Pular; de novo no ar, pulo duplo'],
        ['Espaço 2x', 'Com uma direção apertada vira o mortal que chuta a bola'],
        ['E', 'Câmera na bola ou livre'],
        ['Tab', 'Segure para ver as estatísticas'],
        ['Esc', 'Configurações (times, espectar, sair)'],
      ];
  return (
    <div className="bola-tips" role="dialog" aria-label="Como jogar" data-testid="bola-tips">
      <h2>Como jogar</h2>
      <ul>
        {rows.map(([k, v]) => (
          <li key={k}>
            <kbd>{k}</kbd>
            <span>{v}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="dsm-btn" onClick={done} data-testid="bola-tips-ok">
        Entendi
      </button>
    </div>
  );
}
