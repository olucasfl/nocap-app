import { useRef, useState, type CSSProperties } from 'react';
import { SONGS, SONG_IDS, isSongId, type SongId } from '@nocap/games';
import { ArrowRight } from '@/components/icons';
import { estimateLatency, getBatidaLatency, setBatidaLatency } from '@/lib/batida-latency';
import { audioKit } from '@/lib/sfx';
import { BatidaKeys } from '../BatidaKeys';

/** Ritmo do ajuste: uma batida a cada 600 ms. */
const BEAT_S = 0.6;
const BEATS = 12;
/** Toques que contam (os primeiros servem para entrar no ritmo). */
const SKIP = 3;

/**
 * Ajuste de atraso, de canto: a pessoa toca junto com uma batida constante e o desvio mediano dos
 * toques vira o atraso descontado na partida. Fica atrás de um botão discreto e nunca é pedido
 * antes de jogar.
 */
function Calibration({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle');
  const [result, setResult] = useState<number | null>(null);
  const beats = useRef<number[]>([]);
  const devs = useRef<number[]>([]);
  const timer = useRef(0);

  const begin = () => {
    const kit = audioKit();
    if (!kit) return setResult(null);
    const { ctx, out } = kit;
    const first = ctx.currentTime + 0.8;
    beats.current = Array.from({ length: BEATS }, (_, i) => first + i * BEAT_S);
    devs.current = [];
    for (const when of beats.current) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = 1000;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.35, when + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
      o.connect(g).connect(out);
      o.start(when);
      o.stop(when + 0.08);
    }
    setState('running');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => finish(), (0.8 + BEATS * BEAT_S + 0.4) * 1000);
  };

  const finish = () => {
    const est = estimateLatency(devs.current);
    setResult(est);
    if (est !== null) setBatidaLatency(est);
    setState('done');
  };

  const tap = () => {
    const kit = audioKit();
    if (!kit || state !== 'running') return;
    const now = kit.ctx.currentTime;
    // O desvio é para a batida mais perto; as primeiras ficam de fora.
    let best = 0;
    for (let i = 0; i < beats.current.length; i++) {
      if (Math.abs(beats.current[i]! - now) < Math.abs(beats.current[best]! - now)) best = i;
    }
    if (best < SKIP) return;
    devs.current.push(Math.round((now - beats.current[best]!) * 1000));
  };

  return (
    <div className="bt-cal" role="group" aria-label="Ajustar atraso do toque">
      <p className="mono">
        {state === 'idle' &&
          'Ouça a batida e toque no botão junto com cada uma. Isso acerta o atraso do seu aparelho.'}
        {state === 'running' && 'Toque junto com a batida...'}
        {state === 'done' &&
          (result === null
            ? 'Poucos toques. Tente de novo.'
            : `Pronto: atraso de ${result} ms descontado.`)}
      </p>
      <div className="bt-cal-row">
        {state === 'running' ? (
          <button type="button" className="btn alt" onPointerDown={tap}>
            TOQUE
          </button>
        ) : (
          <button type="button" className="btn alt" data-sfx="select" onClick={begin}>
            {state === 'done' ? 'Ajustar de novo' : 'Começar o ajuste'}
          </button>
        )}
        <button
          type="button"
          className="btn ghost"
          data-sfx="back"
          disabled={state === 'running'}
          onClick={() => {
            window.clearTimeout(timer.current);
            onClose();
          }}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

const SONG_COLOR: Record<SongId, string> = {
  passo: 'var(--green)',
  mare: 'var(--yellow)',
  frenesi: 'var(--orange)',
};
const SONG_LEVEL: Record<SongId, string> = { passo: 'FÁCIL', mare: 'MÉDIA', frenesi: 'DIFÍCIL' };
const SONG_KEY = 'nocap-batida-song';

/** A última música escolhida (a primeira vez, a mais calma). */
function lastSong(): SongId {
  try {
    const id = localStorage.getItem(SONG_KEY);
    return isSongId(id) ? id : 'passo';
  } catch {
    return 'passo';
  }
}

/**
 * Abertura do Eco Hero: a pessoa escolhe uma das três músicas e começa. As teclas do computador
 * e o ajuste de atraso ficam de canto, sem atrapalhar quem só quer jogar.
 */
export function BatidaIntro({ onBegin }: { onBegin: (song: SongId) => void }) {
  const [song, setSong] = useState<SongId>(lastSong);
  const [calibrating, setCalibrating] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const latency = getBatidaLatency();

  const pick = (id: SongId) => {
    setSong(id);
    try {
      localStorage.setItem(SONG_KEY, id);
    } catch {
      /* sem storage: escolhe de novo da próxima vez */
    }
  };

  return (
    <section className="screen eco-intro">
      <div className="mono eco-label">ECO HERO</div>
      <h1>Escolha a música</h1>
      <ul className="bt-songs" role="radiogroup" aria-label="Música">
        {SONG_IDS.map((id) => {
          const s = SONGS[id];
          return (
            <li key={id}>
              <button
                type="button"
                role="radio"
                data-sfx="select"
                className="bt-song"
                style={{ '--song': SONG_COLOR[id] } as CSSProperties}
                aria-checked={song === id}
                onClick={() => pick(id)}
              >
                <span className="bt-song-head">
                  <b>{s.name}</b>
                  <span className="mono bt-song-meta">{SONG_LEVEL[id]}</span>
                </span>
                <p>{s.tagline}</p>
                <span className="mono bt-song-meta">
                  {s.startBpm}→{s.maxBpm} BATIDAS POR MINUTO
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <ol className="eco-steps">
        <li>
          <b>1</b>
          <span>
            As notas vêm do fundo da pista e encaixam nos moldes coloridos. Toque na pista quando a
            nota chegar no molde: cada acerto toca uma nota e, juntas, elas formam a música.
          </span>
        </li>
        <li>
          <b>2</b>
          <span>
            Acertos seguidos sobem o multiplicador (até x4) e a música ganha instrumentos. Cada erro
            gasta a energia e a música tropeça. Zerou, acabou.
          </span>
        </li>
      </ol>
      <p className="eco-intro-extra">
        Com o tempo vêm notas juntas (use mais de um dedo, até 3) e barras compridas: aperte e
        segure até o fim. Ligue o som. No computador, 1 a 5 tocam (dá para trocar).
      </p>
      <div className="stack">
        <button type="button" className="btn" data-sfx="start" onClick={() => onBegin(song)}>
          Começar <ArrowRight />
        </button>
        {showKeys && <BatidaKeys />}
        {calibrating && <Calibration onClose={() => setCalibrating(false)} />}
        {!calibrating && (
          <div className="bt-cal-links">
            <button
              type="button"
              className="bt-cal-link mono"
              data-sfx="select"
              onClick={() => setShowKeys((v) => !v)}
            >
              {showKeys ? 'Esconder teclas' : 'Teclas do computador'}
            </button>
            <button
              type="button"
              className="bt-cal-link mono"
              data-sfx="select"
              onClick={() => setCalibrating(true)}
            >
              Ajustar atraso do toque{latency !== 0 ? ` (agora ${latency} ms)` : ''}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
