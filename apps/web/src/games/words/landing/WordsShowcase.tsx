import type { CSSProperties, ReactNode } from 'react';
import type { WordsGame } from './WordsLandingArt';

const v = (o: Record<string, string | number>) => o as CSSProperties;

/** Os quadros animados do menu de cada jogo (spec 074): uma amostra do próprio jogo, em loop, só com transform e opacity. */
function Demo({ game }: { game: WordsGame }): ReactNode {
  if (game === 'classic') {
    const rows: { w: string; k: string[]; d: number }[] = [
      { w: 'AMBOS', k: ['hit', 'hit', 'miss', 'near', 'miss'], d: 0 },
      { w: 'AMIGO', k: ['hit', 'hit', 'hit', 'hit', 'hit'], d: 2.2 },
    ];
    return (
      <div className="wd-classic">
        {rows.map((r) => (
          <div key={r.w} className="wd-row">
            {[...r.w].map((ch, i) => (
              <span
                key={i}
                className={`wd-t ${r.k[i]}${r.d > 0 ? ' win' : ''}`}
                style={v({ '--d': `${r.d + i * 0.18}s` })}
              >
                <b>{ch}</b>
              </span>
            ))}
          </div>
        ))}
        <div className="wd-row dim">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="wd-t empty" />
          ))}
        </div>
      </div>
    );
  }
  if (game === 'connect') {
    const groups = [
      { c: '#ffd23f', w: ['ONÇA', 'LOBO', 'URSO', 'TIGRE'] },
      { c: '#3fcf7d', w: ['MESA', 'SOFÁ', 'CAMA', 'BANCO'] },
      { c: '#4a8dff', w: ['AZUL', 'ROSA', 'VERDE', 'ROXO'] },
      { c: '#a06bff', w: ['LUA', 'SOL', 'MAR', 'VENTO'] },
    ];
    return (
      <div className="wd-connect">
        {groups.map((g, r) =>
          g.w.map((w, i) => (
            <span
              key={w}
              className="wd-chip"
              style={v({
                '--c': g.c,
                '--dx': `${((i * 53 + r * 31) % 90) - 45}px`,
                '--dy': `${((r * 47 + i * 29) % 120) - 60}px`,
                '--n': r * 4 + i,
              })}
            >
              <i />
              <b>{w}</b>
            </span>
          )),
        )}
      </div>
    );
  }
  if (game === 'bee') {
    const ring = ['A', 'B', 'E', 'L', 'H', 'M'];
    const order = [0, 1, 2, 3, 4, 0];
    return (
      <div className="wd-bee">
        {ring.map((ch, i) => (
          <i
            key={i}
            className={`wd-hx ring${order.indexOf(i) < 0 ? ' idle' : ''}`}
            style={v({ '--a': `${i * 60}deg`, '--s': Math.max(0, order.indexOf(i)) })}
          >
            <b>{ch}</b>
          </i>
        ))}
        <i className="wd-hx mid">
          <b>E</b>
        </i>
        <span className="wd-pts">+7</span>
        <span className="wd-word">ABELHA</span>
      </div>
    );
  }
  if (game === 'blocks') {
    const cols = ['#ff6a2b', '#ffd23f', '#3f6bff', '#3fcf7d', '#a06bff'];
    return (
      <div className="wd-blocks">
        {Array.from({ length: 25 }, (_, i) => {
          const r = Math.floor(i / 5);
          const c = i % 5;
          const filled = r === 4 && c !== 2;
          const half = r === 3 && (c === 0 || c === 1);
          return (
            <i
              key={i}
              className={filled ? 'row' : half ? 'half' : r === 4 ? 'gap' : ''}
              style={v({ '--c': cols[(c + r) % 5]! })}
            />
          );
        })}
        <i className="wd-drop" style={v({ '--c': '#ffd23f' })} />
        <i className="wd-flash" />
      </div>
    );
  }
  if (game === 'color') {
    return (
      <div className="wd-color">
        <div className="wd-sw target">
          <small>ALVO</small>
          <i />
        </div>
        <div className="wd-sw guess">
          <small>VOCÊ</small>
          <i className="a" />
          <i className="b" />
          <span className="wd-ring" />
        </div>
        <div className="wd-sliders">
          {['MATIZ', 'SATUR.', 'BRILHO'].map((n, i) => (
            <div key={n} className="wd-sl">
              <span>{n}</span>
              <div>
                <i className="mark" />
                <i className="knob" style={v({ '--i': i })} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (game === 'time') {
    return (
      <div className="wd-time">
        <i className="dial" />
        {Array.from({ length: 12 }, (_, i) => (
          <i key={i} className="arm tick" style={{ transform: `rotate(${i * 30}deg)` }} />
        ))}
        <i className="arm tgt" />
        <i className="arm lock" />
        <i className="arm hand" />
        <i className="hub" />
      </div>
    );
  }
  // eco
  const pads = ['#ff5a4d', '#ffd23f', '#3fcf7d', '#4a8dff'];
  return (
    <div className="wd-eco">
      {pads.map((c, i) => (
        <span key={c} className="wd-pad" style={v({ '--c': c, '--d': `${i * 0.85}s` })}>
          <i />
          <u />
        </span>
      ))}
      <div className="wd-steps">
        {Array.from({ length: 4 }, (_, i) => (
          <i key={i} style={v({ '--d': `${i * 0.85}s` })} />
        ))}
      </div>
    </div>
  );
}

const TITLE: Record<WordsGame, string> = {
  classic: 'Descubra a palavra',
  connect: 'Ligue os 4 grupos',
  bee: 'Ache todas as palavras',
  blocks: 'Encaixe e limpe a linha',
  color: 'Recrie a cor de memória',
  time: 'Pare na hora certa',
  eco: 'Repita a sequência',
};

/** O quadro à direita do menu: título, uma amostra animada do jogo e a frase, centrados na área livre. */
export function Showcase({ game, text }: { game: WordsGame; text: string }) {
  return (
    <div className={`wl-show wd-${game}-wrap`}>
      <span className="wl-show-kicker mono">{TITLE[game]}</span>
      <div className="wl-stagecard">
        <Demo game={game} />
      </div>
      <p className="wl-show-text">{text}</p>
    </div>
  );
}
