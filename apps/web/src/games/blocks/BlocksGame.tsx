import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { BlocksMode } from '@nocap/games';
import { BackButton } from '@/components/BackButton';
import { ModePicker } from '@/components/ModePicker';
import { ModeSheet } from '@/components/ModeSheet';
import { MuteButton } from '@/components/MuteButton';
import { ArrowRight } from '@/components/icons';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { bestTenths, fetchStats } from '@/lib/stats';
import { BlockDefs, Star, ThumbSeal } from './art';
import { BlocksPlay, type BlocksEnd } from './BlocksPlay';
import { getBlocksBest, setBlocksBest } from './storage';
import { SAVE_TEXT, useSaveBlocks, type BlocksRunInfo } from './useSaveBlocks';
import './blocks.css';

type Phase = 'menu' | 'play' | 'final';

/** Os modos de blocos. O Block Classic é o primeiro; outros entram aqui depois. */
const MODES: { id: BlocksMode; label: string; desc: string; lead: string }[] = [
  {
    id: 'classic',
    label: 'Block Classic',
    desc: '8X8 · SEM TEMPO · 3 DICAS',
    lead: 'Encaixe as peças na grade de 8x8 e complete linhas e colunas para fazê-las sumir. Sem tempo: a partida acaba quando nenhuma peça que resta cabe. O recorde são os pontos.',
  },
];

const RULES: [string, string][] = [
  ['8x8', 'grade'],
  ['3', 'peças por vez'],
  ['3', 'dicas'],
];

const HOW = [
  'Arraste cada uma das 3 peças para a grade. Elas não giram. Quando as 3 estão colocadas, vêm outras 3.',
  'Linha ou coluna inteira cheia some. Várias de uma vez rendem muito mais, e limpar em jogadas seguidas forma um COMBO.',
  'Coloque a peça na melhor posição e ganha um JOINHA. As 3 peças nas melhores posições, e é PERFECT.',
  'Tem 3 dicas por partida. Acabaram, acabou a ajuda. A partida termina quando nada mais cabe.',
];

const seedOf = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

/** O menu: o Block's como aba de jogos de blocos, com cada modo como cartão. */
function BlocksStart({ onStart, busy }: { onStart: (mode: BlocksMode) => void; busy: boolean }) {
  const user = useAuth((st) => st.user);
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const [open, setOpen] = useState<BlocksMode | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const best = open
    ? Math.max(getBlocksBest(), Math.floor(bestTenths(stats.data, 'blocks', open) / 10))
    : 0;
  const current = MODES.find((m) => m.id === open);

  return (
    <section className="screen">
      <BackButton to="/" label="Jogos" />
      <h1 className="bk-title">Block&apos;s</h1>
      <p className="mono bk-subtitle">JOGOS DE BLOCOS</p>
      <ModePicker game="blocks" modes={MODES} onOpen={(id) => setOpen(id as BlocksMode)} />
      <div className="bk-soon mono">+ MAIS MODOS DE BLOCOS EM BREVE</div>
      {open && current && (
        <ModeSheet
          game="blocks"
          modeId={open}
          title={current.label}
          lead={current.lead}
          record={best > 0 ? `Seu recorde aqui é de ${best} pontos` : null}
          onClose={close}
          rules={RULES.map(([big, small]) => (
            <div className="bk-rule" key={small}>
              <b>{big}</b>
              {small}
            </div>
          ))}
        >
          <ol className="bk-howto">
            {HOW.map((t, i) => (
              <li key={i}>
                <b>{i + 1}</b>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="btn" data-sfx="start" disabled={busy} onClick={() => onStart(open)}>
            {busy ? 'Preparando...' : 'Jogar'} <ArrowRight />
          </button>
          {!user && (
            <p className="mono bk-meta">
              ENTRE NA SUA CONTA PARA SALVAR NO RANKING, NO HISTÓRICO E NOS RECORDES.
            </p>
          )}
        </ModeSheet>
      )}
    </section>
  );
}

/** O fim da partida: pontos, recorde, joinhas, PERFECTs e o que fazer a seguir. */
function BlocksFinal({
  mode,
  end,
  before,
  run,
  busy,
  onAgain,
  onMenu,
}: {
  mode: BlocksMode;
  end: BlocksEnd;
  before: number;
  run: BlocksRunInfo;
  busy: boolean;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const user = useAuth((st) => st.user);
  const save = useSaveBlocks(run, mode, end.moves);
  const score = end.result.score;
  const isRecord = score > before;
  const best = Math.max(score, before);
  const pct = best > 0 ? Math.round((score / best) * 100) : 0;
  return (
    <section className="screen bkf">
      <BlockDefs />
      <div className="bkf-verdict">
        <span className="mono bkf-kicker">BLOCK&apos;S · BLOCK CLASSIC</span>
        <h1>SEM ESPAÇO</h1>
        <p className="mono">Nenhuma das peças que sobraram cabe no tabuleiro.</p>
      </div>

      <div className="bkf-score">
        {isRecord && (
          <span className="bkf-badge mono">
            <Star size={16} /> {before > 0 ? 'NOVO RECORDE' : 'PRIMEIRO RECORDE'}
          </span>
        )}
        <span className="mono bkf-label">PONTOS</span>
        <div className="bkf-big">
          <b>{score}</b>
        </div>
        <div className="bkf-meter" aria-label={`${pct}% do seu recorde`}>
          <i style={{ transform: `scaleX(${Math.min(1, pct / 100)})` }} />
        </div>
        <span className="mono bkf-hint">
          {isRecord
            ? before > 0
              ? `+${score - before} pontos sobre o recorde anterior`
              : 'Esse é o seu primeiro resultado neste modo'
            : `${pct}% do seu recorde`}
        </span>
      </div>

      <div className="bkf-praise">
        <div className="bkf-praise-item">
          <ThumbSeal size={54} />
          <b>{end.thumbs}</b>
          <span className="mono">JOINHAS</span>
        </div>
        <div className="bkf-praise-item perfect">
          <i aria-hidden="true">P</i>
          <b>{end.perfects}</b>
          <span className="mono">PERFECT</span>
        </div>
      </div>

      <dl className="bkf-stats">
        <div>
          <dt className="mono">SEU RECORDE</dt>
          <dd>{best}</dd>
        </div>
        <div>
          <dt className="mono">LINHAS LIMPAS</dt>
          <dd>{end.result.lines}</dd>
        </div>
        <div>
          <dt className="mono">MAIOR COMBO</dt>
          <dd>x{end.result.bestStreak}</dd>
        </div>
        <div>
          <dt className="mono">JOGADAS</dt>
          <dd>{end.result.moves}</dd>
        </div>
        <div>
          <dt className="mono">DICAS USADAS</dt>
          <dd>{end.hintsUsed}/3</dd>
        </div>
        <div>
          <dt className="mono">RECORDE ANTERIOR</dt>
          <dd>{before > 0 ? before : '-'}</dd>
        </div>
      </dl>

      <p className="mono bkf-note" role="status">
        {user || save === 'saved'
          ? SAVE_TEXT[save]
          : 'ENTRE NA SUA CONTA PARA SALVAR NO RANKING E NO HISTÓRICO'}
      </p>

      <div className="stack bkf-actions">
        <button type="button" className="btn alt" data-sfx="start" disabled={busy} onClick={onAgain}>
          {busy ? 'Preparando...' : 'Jogar de novo'}
        </button>
        <Link to="/ranking" search={{ jogo: 'blocks', modo: mode }} className="btn ghost" data-sfx="select">
          Ver ranking
        </Link>
        <Link
          to="/ranking"
          search={{ jogo: 'blocks', modo: mode, quem: 'friends' }}
          className="btn ghost"
          data-sfx="select"
        >
          Ranking dos amigos
        </Link>
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

/** O Block's: menu de modos, partida em tela cheia e fim. */
export function BlocksGame() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [mode, setMode] = useState<BlocksMode>('classic');
  const [run, setRun] = useState<BlocksRunInfo>(() => ({
    matchId: crypto.randomUUID(),
    seed: seedOf(),
    session: '',
  }));
  const [end, setEnd] = useState<BlocksEnd | null>(null);
  const [before, setBefore] = useState(0);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  /**
   * O servidor sorteia a seed e assina o início (é isso que deixa a partida valer no ranking).
   * Sem conta ou sem internet dá para jogar do mesmo jeito, só que como treino.
   */
  const begin = async (m: BlocksMode = mode) => {
    if (busy) return;
    setBusy(true);
    setMode(m);
    let seed = seedOf();
    let session = '';
    try {
      ({ seed, session } = await apiClient.post<{ seed: string; session: string }>(
        '/games/blocks/session',
        { kind: 'solo' },
      ));
    } catch {
      /* sem conta ou sem rede: treino local, a partida não é salva */
    }
    let best = getBlocksBest();
    try {
      const stats = await queryClient.fetchQuery({ queryKey: ['stats'], queryFn: fetchStats, staleTime: 0 });
      best = Math.max(best, Math.floor(bestTenths(stats, 'blocks', m) / 10));
    } catch {
      /* convidado: vale o recorde deste aparelho */
    }
    setBefore(best);
    setRun({ matchId: crypto.randomUUID(), seed, session });
    setBusy(false);
    setPhase('play');
  };

  if (phase === 'play') {
    return (
      <BlocksPlay
        key={run.seed}
        seed={run.seed}
        best={before}
        onEnd={(e) => {
          // O recorde guardado aqui é deste aparelho; o ranking de verdade vem do servidor.
          setBlocksBest(e.result.score);
          setEnd(e);
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
      {phase === 'menu' && <BlocksStart onStart={(m) => void begin(m)} busy={busy} />}
      {phase === 'final' && end && (
        <BlocksFinal
          mode={mode}
          end={end}
          before={before}
          run={run}
          busy={busy}
          onAgain={() => void begin()}
          onMenu={() => setPhase('menu')}
        />
      )}
    </div>
  );
}
