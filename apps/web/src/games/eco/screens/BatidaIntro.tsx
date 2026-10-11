import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
  const flashEl = useRef<HTMLDivElement>(null);

  // A batida também pisca na tela, no instante em que se ouve: assim o ajuste inclui o atraso da
  // tela, que é o que a pessoa acompanha na partida (as notas), e não só o do som.
  useEffect(() => {
    if (state !== 'running') return;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const kit = audioKit();
      const el = flashEl.current;
      if (!kit || !el) return;
      const ts = kit.ctx.getOutputTimestamp?.();
      const heard =
        ts && ts.contextTime !== undefined && ts.performanceTime
          ? ts.contextTime + (performance.now() - ts.performanceTime) / 1000
          : kit.ctx.currentTime;
      let near = Infinity;
      for (const b of beats.current) near = Math.min(near, Math.abs(b - heard));
      el.style.opacity = near < 0.07 ? '1' : '0.12';
      el.style.transform = near < 0.07 ? 'scale(1)' : 'scale(0.7)';
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state]);

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
    // Quem acompanha uma batida antecipa; na partida a nota é reação. Nunca adianta o julgamento.
    if (est !== null) setBatidaLatency(Math.max(0, est));
    setState('done');
  };

  const tap = (stamp: number) => {
    const kit = audioKit();
    if (!kit || state !== 'running') return;
    // O mesmo relógio da partida: o ponto do áudio que está saindo no alto-falante, no horário do toque.
    const ts = kit.ctx.getOutputTimestamp?.();
    const now =
      ts && ts.contextTime !== undefined && ts.performanceTime
        ? ts.contextTime + (stamp - ts.performanceTime) / 1000
        : kit.ctx.currentTime;
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
          'Olhe a bolinha e ouça a batida: toque no botão junto com cada uma. Isso acerta o atraso do seu aparelho.'}
        {state === 'running' && 'Toque junto com a batida...'}
        {state === 'done' &&
          (result === null
            ? 'Poucos toques. Tente de novo.'
            : `Pronto: atraso de ${result} ms descontado.`)}
      </p>
      {state === 'running' && (
        <div
          ref={flashEl}
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            margin: '8px auto',
            borderRadius: '50%',
            background: 'var(--ink)',
            opacity: 0.12,
          }}
        />
      )}
      <div className="bt-cal-row">
        {state === 'running' ? (
          <button type="button" className="btn alt" onPointerDown={(e) => tap(e.timeStamp)}>
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

/** Ajuste do toque: o valor atual, os botões de -10/+10 e a calibração por batida. */
function Tune() {
  const [ms, setMs] = useState(getBatidaLatency);
  const [calibrating, setCalibrating] = useState(false);
  const step = (d: number) => {
    const next = Math.max(-250, Math.min(250, ms + d));
    setBatidaLatency(next);
    setMs(next);
  };
  return (
    <div className="bt-setting">
      <div className="bt-setting-head">
        <b>Ajuste do toque</b>
        <span className="mono">{ms} MS</span>
      </div>
      <p>Tocou no molde e deu TARDE? Aumente. Deu CEDO? Diminua. O jogo também se ajusta sozinho.</p>
      <div className="bt-setting-row">
        <button type="button" className="btn ghost" data-sfx="select" onClick={() => step(-10)}>
          -10
        </button>
        <button type="button" className="btn ghost" data-sfx="select" onClick={() => step(10)}>
          +10
        </button>
        <button
          type="button"
          className="btn ghost"
          data-sfx="select"
          onClick={() => setCalibrating((v) => !v)}
        >
          {calibrating ? 'Fechar' : 'Calibrar'}
        </button>
      </div>
      {calibrating && (
        <Calibration
          onClose={() => {
            setMs(getBatidaLatency());
            setCalibrating(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Abertura do Eco Hero em dois passos: primeiro só as três músicas; ao escolher uma, aparecem as
 * regras e as configurações (teclas e ajuste do toque), bem à vista, e então o botão de começar.
 */
export function BatidaIntro({ onBegin }: { onBegin: (song: SongId) => void }) {
  const [song, setSong] = useState<SongId | null>(null);

  const pick = (id: SongId) => {
    setSong(id);
    try {
      localStorage.setItem(SONG_KEY, id);
    } catch {
      /* sem storage: escolhe de novo da próxima vez */
    }
  };

  if (!song) {
    return (
      <section className="screen eco-intro">
        <div className="mono eco-label">ECO HERO</div>
        <h1>Escolha a música</h1>
        <ul className="bt-songs" aria-label="Músicas">
          {SONG_IDS.map((id) => {
            const s = SONGS[id];
            return (
              <li key={id}>
                <button
                  type="button"
                  data-sfx="select"
                  className="bt-song"
                  style={{ '--song': SONG_COLOR[id] } as CSSProperties}
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
      </section>
    );
  }

  const s = SONGS[song];
  return (
    <section className="screen eco-intro">
      <div className="mono eco-label">ECO HERO</div>
      <h1>{s.name}</h1>
      <p className="mono bt-song-meta">
        {SONG_LEVEL[song]} · {s.startBpm}→{s.maxBpm} BATIDAS POR MINUTO
      </p>

      <h2 className="bt-section">Como jogar</h2>
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
        <li>
          <b>3</b>
          <span>
            Com o tempo vêm notas juntas (use mais de um dedo, até 3) e barras compridas: aperte e
            segure até o fim. Ligue o som.
          </span>
        </li>
      </ol>

      <h2 className="bt-section">Configurações</h2>
      <div className="bt-setting">
        <div className="bt-setting-head">
          <b>Teclas do computador</b>
        </div>
        <BatidaKeys />
      </div>
      <Tune />

      <div className="stack">
        <button type="button" className="btn" data-sfx="start" onClick={() => onBegin(song)}>
          Começar <ArrowRight />
        </button>
        <button type="button" className="btn ghost" data-sfx="back" onClick={() => setSong(null)}>
          Trocar de música
        </button>
      </div>
    </section>
  );
}
