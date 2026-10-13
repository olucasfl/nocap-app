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
import { getBlocksBest, getTowersBest, setBlocksBest, setTowersBest } from './storage';
import { TowersPlay, type TowersEnd } from './towers/TowersPlay';
import { SaveNote } from '@/components/GuestNotice';
import { useSaveBlocks, type BlocksRunInfo } from './useSaveBlocks';
import './blocks.css';

type Phase = 'menu' | 'play' | 'final';

/** Os modos da aba: o Block Classic (vale no ranking) e o Block Towers (só neste aparelho, por ora). */
type UiMode = BlocksMode | 'towers';

/** Os modos de blocos. O Block Classic e o Block Towers; outros entram aqui depois. */
const MODES: { id: UiMode; label: string; desc: string; lead: string }[] = [
  {
    id: 'classic',
    label: 'Block Classic',
    desc: '8X8 · SEM TEMPO · 3 DICAS',
    lead: 'Encaixe as peças na grade de 8x8 e complete linhas e colunas para fazê-las sumir. Sem tempo: a partida acaba quando nenhuma peça que resta cabe. O recorde são os pontos.',
  },
  {
    id: 'towers',
    label: 'Block Towers',
    desc: 'FÍSICA · 3 VIDAS · MAGIAS',
    lead: 'As peças caem uma por vez e você monta uma torre que balança de verdade. Peça que cai da torre custa uma vida; com 3 vidas perdidas, acabou. O recorde são as peças empilhadas.',
  },
];

const RULES: Record<UiMode, [string, string][]> = {
  classic: [
    ['8x8', 'grade'],
    ['3', 'peças por vez'],
    ['3', 'dicas'],
  ],
  towers: [
    ['3', 'vidas'],
    ['física', 'em tudo'],
    ['magias', 'boas e ruins'],
  ],
};

const HOW: Record<UiMode, string[]> = {
  classic: [
    'Arraste cada uma das 3 peças para a grade. Elas não giram. Quando as 3 estão colocadas, vêm outras 3.',
    'Linha ou coluna inteira cheia some. Várias de uma vez rendem muito mais, e limpar em jogadas seguidas forma um COMBO.',
    'Coloque a peça na melhor posição e ganha um JOINHA. As 3 peças nas melhores posições, e é PERFECT.',
    'Tem 3 dicas por partida. Acabaram, acabou a ajuda. A partida termina quando nada mais cabe.',
  ],
  towers: [
    'A peça desce sozinha. Mova para os lados, gire e acelere a descida para encaixar na torre. O guia no alto mostra a próxima.',
    'Tudo tem física: a torre balança e pode desmoronar. Cada peça que cair custa uma vida, e são 3.',
    'A cada 5 peças chega uma magia. As boas você guarda e usa quando quiser (vinha, cimento, desfazer, vida extra). As ruins caem sobre você sozinhas.',
    'A nota é o máximo de peças que você chegou a ter empilhadas. Ela vale no ranking, no histórico e no perfil.',
  ],
};

const seedOf = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

/** O menu: o Block's como aba de jogos de blocos, com cada modo como cartão. */
function BlocksStart({ onStart, busy }: { onStart: (mode: UiMode) => void; busy: boolean }) {
  const user = useAuth((st) => st.user);
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user });
  const [open, setOpen] = useState<UiMode | null>(null);
  const close = useCallback(() => setOpen(null), []);
  // Com conta, o recorde é o do servidor (o mesmo do ranking); o do aparelho só vale sem conta.
  const best =
    !open || !user
      ? 0
      : stats.data
        ? Math.floor(bestTenths(stats.data, 'blocks', open) / 10)
        : open === 'towers'
          ? getTowersBest()
          : getBlocksBest();
  const current = MODES.find((m) => m.id === open);

  return (
    <section className="screen">
      <BackButton to="/" label="Jogos" />
      <h1 className="bk-title">Block&apos;s</h1>
      <p className="mono bk-subtitle">JOGOS DE BLOCOS</p>
      <ModePicker game="blocks" modes={MODES} onOpen={(id) => setOpen(id as UiMode)} />
      <div className="bk-soon mono">+ MAIS MODOS DE BLOCOS EM BREVE</div>
      {open && current && (
        <ModeSheet
          game="blocks"
          modeId={open}
          title={current.label}
          lead={current.lead}
          record={
            best > 0
              ? `Seu recorde aqui é de ${best} ${open === 'towers' ? 'peças' : 'pontos'}`
              : null
          }
          onClose={close}
          rules={RULES[open].map(([big, small]) => (
            <div className="bk-rule" key={small}>
              <b>{big}</b>
              {small}
            </div>
          ))}
        >
          <ol className="bk-howto">
            {HOW[open].map((t, i) => (
              <li key={i}>
                <b>{i + 1}</b>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="btn"
            data-sfx="start"
            disabled={busy}
            onClick={() => onStart(open)}
          >
            {busy ? 'Preparando...' : 'Jogar'} <ArrowRight />
          </button>
          {open === 'towers' && (
            <p className="mono bk-meta">
              NO CELULAR USE OS BOTÕES. NO COMPUTADOR: SETAS OU A/D, CIMA PARA GIRAR, BAIXO PARA
              DESCER E E PARA A MAGIA.
            </p>
          )}
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
  const save = useSaveBlocks(run, mode, end.moves);
  const score = end.result.score;
  const guest = save === 'guest';
  // Sem conta não há recorde: só a nota desta partida.
  const isRecord = !guest && score > before;
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
        {!guest && (
          <>
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
          </>
        )}
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
        {!guest && (
          <div>
            <dt className="mono">SEU RECORDE</dt>
            <dd>{best}</dd>
          </div>
        )}
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
        {!guest && (
          <div>
            <dt className="mono">RECORDE ANTERIOR</dt>
            <dd>{before > 0 ? before : '-'}</dd>
          </div>
        )}
      </dl>

      <SaveNote className="mono bkf-note" save={save} />

      <div className="stack bkf-actions">
        <button
          type="button"
          className="btn alt"
          data-sfx="start"
          disabled={busy}
          onClick={onAgain}
        >
          {busy ? 'Preparando...' : 'Jogar de novo'}
        </button>
        {!guest && (
          <>
            <Link
              to="/ranking"
              search={{ jogo: 'blocks', modo: mode }}
              className="btn ghost"
              data-sfx="select"
            >
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
          </>
        )}
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

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** O fim do Block Towers: peças empilhadas, recorde e o resumo da torre. */
function TowersFinal({
  end,
  before,
  run,
  busy,
  onAgain,
  onMenu,
}: {
  end: TowersEnd;
  before: number;
  run: BlocksRunInfo;
  busy: boolean;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const save = useSaveBlocks(run, 'towers', end.moves);
  const score = end.score;
  const guest = save === 'guest';
  // Sem conta não há recorde: só a nota desta partida.
  const isRecord = !guest && score > before;
  const best = Math.max(score, before);
  const pct = best > 0 ? Math.round((score / best) * 100) : 0;
  return (
    <section className="screen bkf">
      <div className="bkf-verdict">
        <span className="mono bkf-kicker">BLOCK&apos;S · BLOCK TOWERS</span>
        <h1>SEM VIDAS</h1>
        <p className="mono">
          {end.collapses > 0
            ? 'A torre desabou. Mais cuidado no equilíbrio, ou use a vinha e o cimento.'
            : 'Peças demais caíram da torre. Procure apoios largos e planos.'}
        </p>
      </div>

      <div className="bkf-score">
        {isRecord && (
          <span className="bkf-badge mono">{before > 0 ? 'NOVO RECORDE' : 'PRIMEIRO RECORDE'}</span>
        )}
        <span className="mono bkf-label">PEÇAS EMPILHADAS</span>
        <div className="bkf-big">
          <b>{score}</b>
        </div>
        {!guest && (
          <>
            <div className="bkf-meter" aria-label={`${pct}% do seu recorde`}>
              <i style={{ transform: `scaleX(${Math.min(1, pct / 100)})` }} />
            </div>
            <span className="mono bkf-hint">
              {isRecord
                ? before > 0
                  ? `+${score - before} peças sobre o recorde anterior`
                  : 'Esse é o seu primeiro resultado neste modo'
                : `${pct}% do seu recorde`}
            </span>
          </>
        )}
      </div>

      <dl className="bkf-stats">
        {!guest && (
          <div>
            <dt className="mono">SEU RECORDE</dt>
            <dd>{best}</dd>
          </div>
        )}
        <div>
          <dt className="mono">PEÇAS JOGADAS</dt>
          <dd>{end.pieces}</dd>
        </div>
        <div>
          <dt className="mono">TEMPO</dt>
          <dd>{clock(end.time)}</dd>
        </div>
        <div>
          <dt className="mono">MAGIAS</dt>
          <dd>{end.spells}</dd>
        </div>
        <div>
          <dt className="mono">PEÇAS CAÍDAS</dt>
          <dd>{end.falls}</dd>
        </div>
        <div>
          <dt className="mono">CAIU TUDO</dt>
          <dd>{end.collapses}x</dd>
        </div>
      </dl>

      <SaveNote className="mono bkf-note" save={save} />

      <div className="stack bkf-actions">
        <button
          type="button"
          className="btn alt"
          data-sfx="start"
          disabled={busy}
          onClick={onAgain}
        >
          {busy ? 'Preparando...' : 'Jogar de novo'}
        </button>
        {!guest && (
          <>
            <Link
              to="/ranking"
              search={{ jogo: 'blocks', modo: 'towers' }}
              className="btn ghost"
              data-sfx="select"
            >
              Ver ranking
            </Link>
            <Link
              to="/ranking"
              search={{ jogo: 'blocks', modo: 'towers', quem: 'friends' }}
              className="btn ghost"
              data-sfx="select"
            >
              Ranking dos amigos
            </Link>
          </>
        )}
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
  const [mode, setMode] = useState<UiMode>('classic');
  const [towersEnd, setTowersEnd] = useState<TowersEnd | null>(null);
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
  const begin = async (m: UiMode = mode) => {
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
    // Sem conta não há recorde; com conta, o do servidor (e o do aparelho só se ele não responder).
    const signedIn = useAuth.getState().user !== null;
    let best = !signedIn ? 0 : m === 'towers' ? getTowersBest() : getBlocksBest();
    try {
      if (!signedIn) throw new Error('guest');
      const stats = await queryClient.fetchQuery({
        queryKey: ['stats'],
        queryFn: fetchStats,
        staleTime: 0,
      });
      best = Math.floor(bestTenths(stats, 'blocks', m) / 10);
    } catch {
      /* convidado ou sem rede: vale o recorde deste aparelho */
    }
    setBefore(best);
    setRun({ matchId: crypto.randomUUID(), seed, session });
    setBusy(false);
    setPhase('play');
  };

  if (phase === 'play' && mode === 'towers') {
    return (
      <TowersPlay
        key={run.seed}
        seed={run.seed}
        best={before}
        onEnd={(e) => {
          if (useAuth.getState().user) setTowersBest(e.score);
          setTowersEnd(e);
          setPhase('final');
        }}
        onQuit={() => setPhase('menu')}
        onRestart={() => void begin('towers')}
      />
    );
  }

  if (phase === 'play') {
    return (
      <BlocksPlay
        key={run.seed}
        seed={run.seed}
        best={before}
        onEnd={(e) => {
          // O recorde guardado aqui é deste aparelho; o ranking de verdade vem do servidor.
          if (useAuth.getState().user) setBlocksBest(e.result.score);
          setEnd(e);
          setPhase('final');
        }}
        onQuit={() => setPhase('menu')}
        onRestart={() => void begin('classic')}
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
      {phase === 'final' && mode === 'towers' && towersEnd && (
        <TowersFinal
          end={towersEnd}
          before={before}
          run={run}
          busy={busy}
          onAgain={() => void begin()}
          onMenu={() => setPhase('menu')}
        />
      )}
      {phase === 'final' && mode !== 'towers' && end && (
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
