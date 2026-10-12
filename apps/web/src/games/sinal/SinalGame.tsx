import { useCallback, useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { SinalInput, SinalMode, SinalResult } from '@nocap/games';
import { BackButton } from '@/components/BackButton';
import { GameTabs, type GameTab } from '@/components/GameTabs';
import { ModePicker } from '@/components/ModePicker';
import { ModeSheet } from '@/components/ModeSheet';
import { MuteButton } from '@/components/MuteButton';
import { ArrowRight } from '@/components/icons';
import { SinalPlay } from './SinalPlay';
import { getSinalBest, setSinalBest } from './storage';

type Phase = 'menu' | 'play' | 'final';

/** Os modos de partida (o Daily e o online ainda não existem). */
const MODES: { id: SinalMode; label: string; desc: string; lead: string }[] = [
  {
    id: 'classico',
    label: 'Clássico',
    desc: 'FASES · MAPAS · CHEFE',
    lead: 'Quatro fases cada vez mais difíceis e, na quinta, o chefe do mapa. Passou, vem outro mapa. Quando fecha os três, volta ao primeiro e não para. O recorde é a distância total.',
  },
  {
    id: 'infinito',
    label: 'Infinito',
    desc: 'NÃO ACABA · CADA VEZ PIOR',
    lead: 'Um mapa só, sem linha de chegada. Os poderes são aleatórios e a escuridão não para de chegar. O recorde são os metros do ponto mais longe que você foi.',
  },
];

const RULES: Record<SinalMode, [string, string][]> = {
  classico: [
    ['4+1', 'fases por mapa'],
    ['3', 'mapas'],
    ['chefe', 'a cada 5 fases'],
  ],
  infinito: [
    ['sem', 'linha de chegada'],
    ['1', 'mapa sorteado'],
    ['poderes', 'aleatórios'],
  ],
};

const HOW = [
  'O Vigia fica no topo da tela. De costas, você corre. Quando ele olha, fique parado: se mexer, acabou.',
  'Antes de olhar ele dá um sinal (som e imagem) com ele ainda de costas. Às vezes é falso.',
  'O anel no chão é um esconderijo: dentro dele você se mexe mesmo com o Vigia olhando. Mas ele quebra se você ficar demais.',
  'A escuridão vem de trás. Ela nunca é mais rápida que você: só pega quem para demais.',
];

/** O menu do jogo: as abas, os modos como cartões e a ficha do modo (como jogar e Jogar). */
function SinalStart({ onStart }: { onStart: (mode: SinalMode) => void }) {
  const [tab, setTab] = useState<GameTab>('modes');
  const [open, setOpen] = useState<SinalMode | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const best = open ? getSinalBest(open) : 0;

  return (
    <section className="screen">
      <BackButton to="/" label="Jogos" />
      <h1 className="sv-title">Sinal Vermelho</h1>
      <GameTabs game="sinal" tab={tab} onTab={setTab} />
      {tab === 'modes' && (
        <>
          <ModePicker game="sinal" modes={MODES} onOpen={(id) => setOpen(id as SinalMode)} />
          {open && (
            <ModeSheet
              game="sinal"
              modeId={open}
              title={MODES.find((m) => m.id === open)?.label ?? ''}
              lead={MODES.find((m) => m.id === open)?.lead ?? ''}
              record={best > 0 ? `Seu recorde aqui é de ${Math.floor(best)} m` : null}
              onClose={close}
              rules={RULES[open].map(([big, small]) => (
                <div className="sv-rule" key={small}>
                  <b>{big}</b>
                  {small}
                </div>
              ))}
            >
              <ol className="sv-howto">
                {HOW.map((t, i) => (
                  <li key={i}>
                    <b>{i + 1}</b>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
              <p className="mono sv-meta">
                NO CELULAR, O ANALÓGICO FICA EMBAIXO, NO CENTRO. NO COMPUTADOR, W A S D OU AS SETAS.
              </p>
              <button type="button" className="btn" data-sfx="start" onClick={() => onStart(open)}>
                Jogar <ArrowRight />
              </button>
            </ModeSheet>
          )}
        </>
      )}
      {tab === 'friends' && (
        <div className="fp-soon">
          <div className="mono sv-meta">JOGAR COM AMIGOS</div>
          <h2>Em breve</h2>
          <p>
            A corrida online vem depois: todo mundo no mesmo mapa ao mesmo tempo, cada um com a sua
            cor e o nome em cima do boneco. Os bonecos não se atravessam e, ao encostar, o outro é
            empurrado. Quem é visto mexendo ou pego pela escuridão sai da corrida e assiste.
          </p>
          <p className="mono sv-meta">POR ENQUANTO, SÓ O MODO SOLO.</p>
        </div>
      )}
    </section>
  );
}

const seedOf = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

/** O fim da partida: o veredito, a distância, o recorde e o que fazer a seguir. */
function SinalFinal({
  mode,
  result,
  before,
  onAgain,
  onMenu,
}: {
  mode: SinalMode;
  result: SinalResult;
  before: number;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const classic = mode === 'classico';
  const meters = Math.floor(result.meters);
  const prev = Math.floor(before);
  const isRecord = meters > prev;
  const best = Math.max(meters, prev);
  const seen = result.ended === 'vigia';
  const diff = meters - prev;
  const pct = best > 0 ? Math.round((meters / best) * 100) : 0;
  return (
    <section className="screen svf">
      <div className={`svf-verdict ${seen ? 'vigia' : 'dark'}`}>
        <span className="mono svf-kicker">SINAL VERMELHO · {classic ? 'CLÁSSICO' : 'INFINITO'}</span>
        <h1>{seen ? 'O VIGIA TE VIU' : 'A ESCURIDÃO TE PEGOU'}</h1>
        <p className="mono">
          {seen
            ? 'Você se mexeu na hora errada. Pare assim que o aviso tocar.'
            : 'Você demorou demais parado ou se escondeu muito. Ande quando o Vigia estiver de costas.'}
        </p>
      </div>

      <div className="svf-score">
        {isRecord && (
          <span className="svf-badge mono">{prev > 0 ? 'NOVO RECORDE' : 'PRIMEIRO RECORDE'}</span>
        )}
        <span className="mono svf-label">{classic ? 'DISTÂNCIA TOTAL' : 'METROS'}</span>
        <div className="svf-big">
          <b>{meters}</b>
          <span>m</span>
        </div>
        <div className="svf-meter" aria-label={`${pct}% do seu recorde`}>
          <i style={{ transform: `scaleX(${Math.min(1, pct / 100)})` }} />
        </div>
        <span className="mono svf-hint">
          {isRecord ? (prev > 0 ? `+${diff} m sobre o recorde anterior` : 'Esse é o seu primeiro resultado neste modo') : `${pct}% do seu recorde`}
        </span>
      </div>

      <dl className="svf-stats">
        {classic && (
          <div>
            <dt className="mono">FASES CUMPRIDAS</dt>
            <dd>{result.phases}</dd>
          </div>
        )}
        <div>
          <dt className="mono">SEU RECORDE</dt>
          <dd>{best} m</dd>
        </div>
        <div>
          <dt className="mono">RECORDE ANTERIOR</dt>
          <dd>{prev > 0 ? `${prev} m` : '-'}</dd>
        </div>
        <div>
          <dt className="mono">TEMPO DE CORRIDA</dt>
          <dd>{Math.floor(result.endedTick / 60)} s</dd>
        </div>
      </dl>

      <p className="mono svf-note">O ranking online do Sinal Vermelho ainda não está no ar. O recorde fica só neste aparelho.</p>

      <div className="stack svf-actions">
        <button type="button" className="btn alt" data-sfx="start" onClick={onAgain}>
          Jogar de novo
        </button>
        <button type="button" className="btn ghost" data-sfx="back" onClick={onMenu}>
          Voltar ao menu
        </button>
        <Link to="/" className="btn ghost">
          Voltar aos jogos
        </Link>
      </div>
    </section>
  );
}

/** O Sinal Vermelho: menu (modo e cor do boneco), partida em tela cheia e fim. */
export function SinalGame() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [mode, setMode] = useState<SinalMode>('classico');
  const [seed, setSeed] = useState(seedOf);
  const [result, setResult] = useState<SinalResult | null>(null);
  const [before, setBefore] = useState(0);
  const [, setInputs] = useState<SinalInput[]>([]);

  const begin = (m: SinalMode = mode) => {
    setMode(m);
    setBefore(getSinalBest(m));
    setSeed(seedOf());
    setPhase('play');
  };

  if (phase === 'play') {
    return (
      <SinalPlay
        key={seed}
        mode={mode}
        seed={seed}
        best={getSinalBest(mode)}
        onEnd={(r, inp) => {
          // O recorde guardado aqui é deste aparelho; o ranking de verdade vem do servidor.
          setSinalBest(mode, r.meters);
          setResult(r);
          setInputs(inp);
          setPhase('final');
        }}
        onQuit={() => setPhase('menu')}
      />
    );
  }

  return (
    <div className="app">
      <header className="top">
        <Link to="/" className="logo" aria-label="Voltar aos jogos">
          no cap<span>!</span>
        </Link>
        <div className="top-actions">
          <MuteButton />
        </div>
      </header>

      {phase === 'menu' && (
        <SinalStart onStart={begin} />
      )}

      {phase === 'final' && result && <SinalFinal mode={mode} result={result} before={before} onAgain={() => begin()} onMenu={() => setPhase('menu')} />}
    </div>
  );
}
