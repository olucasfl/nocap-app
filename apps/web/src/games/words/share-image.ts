import type { RunView } from './words-api';
import { MODE_LABEL } from './words-api';

const COLOR = { h: '#33c27f', n: '#ffd23f', m: '#4a4a44' } as const;

/**
 * A imagem de compartilhar: só as grades pintadas (sem letras, para não entregar a palavra), o título
 * e a nota, no estilo Pop Brutal. Devolve um PNG.
 */
export function shareImage(run: RunView): Promise<Blob | null> {
  const boards = run.boards.length;
  const cols = boards === 1 ? 1 : 2;
  const cell = boards === 4 ? 26 : boards === 2 ? 30 : 44;
  const gap = 6;
  const boardW = 5 * cell + 4 * gap;
  const boardH = run.tries * cell + (run.tries - 1) * gap;
  const rows = Math.ceil(boards / cols);
  const pad = 32;
  const head = 96;
  const width = Math.max(360, cols * boardW + (cols - 1) * 28 + pad * 2);
  const height = head + rows * boardH + (rows - 1) * 28 + pad + 40;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  if (!g) return Promise.resolve(null);
  g.fillStyle = '#f4f4ef';
  g.fillRect(0, 0, width, height);
  g.fillStyle = '#111';
  g.font = '900 26px Archivo, Arial Black, sans-serif';
  g.fillText(
    run.kind === 'daily' ? `Classic Word's #${run.number}` : `Classic Word's · ${MODE_LABEL[run.mode].name}`,
    pad,
    46,
  );
  g.font = '700 16px Space Mono, monospace';
  const score = run.state === 'won' ? `${run.used}/${run.tries}` : `X/${run.tries}`;
  g.fillText(`${score}  nota ${(run.nota ?? 0).toFixed(1).replace('.', ',')}`, pad, 76);
  const totalW = cols * boardW + (cols - 1) * 28;
  const x0 = (width - totalW) / 2;
  run.boards.forEach((b, i) => {
    const bx = x0 + (i % cols) * (boardW + 28);
    const by = head + Math.floor(i / cols) * (boardH + 28);
    for (let r = 0; r < run.tries; r++) {
      for (let c = 0; c < 5; c++) {
        const x = bx + c * (cell + gap);
        const y = by + r * (cell + gap);
        const code = b.rows[r]?.[c] as keyof typeof COLOR | undefined;
        g.fillStyle = code ? COLOR[code] : '#e4e4dc';
        g.strokeStyle = '#111';
        g.lineWidth = 2.5;
        g.beginPath();
        g.roundRect(x, y, cell, cell, 6);
        g.fill();
        g.stroke();
      }
    }
  });
  g.fillStyle = '#111';
  g.font = '700 13px Space Mono, monospace';
  g.fillText('NOCAP', pad, height - 18);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
