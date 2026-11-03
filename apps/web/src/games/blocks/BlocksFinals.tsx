import type { CSSProperties } from 'react';
import { Link } from '@tanstack/react-router';
import { FinalShell, type FinalTone } from '@/components/final/FinalShell';
import { clock } from '@/components/final/math';
import { useCountUp } from '@/components/final/useCountUp';
import { SaveNote } from '@/components/GuestNotice';
import { ThumbSeal } from './art';
import type { BlocksEnd } from './BlocksPlay';
import type { TowersEnd } from './towers/TowersPlay';
import { useSaveBlocks, type BlocksRunInfo } from './useSaveBlocks';
import './blocks-final.css';

const n = (v: number) => v.toLocaleString('pt-BR');
const d = (i: number) => ({ '--d': `${300 + i * 90}ms` }) as CSSProperties;

/** Blocos que caem atrás do título (Block Classic). */
const FallingBlocks = () => (
  <>
    {Array.from({ length: 8 }, (_, i) => (
      <i key={i} className="bkx-fall" style={{ '--k': i } as CSSProperties} />
    ))}
  </>
);

/** Uma torre que vai crescendo atrás do título (Block Tower). */
const GrowingTower = () => (
  <span className="bkx-tower">
    {Array.from({ length: 6 }, (_, i) => (
      <i key={i} style={{ '--k': i } as CSSProperties} />
    ))}
  </span>
);

interface Common {
  before: number;
  run: BlocksRunInfo;
  busy: boolean;
  onAgain: () => void;
  onMenu: () => void;
}

function Footer({
  mode,
  guest,
  busy,
  onAgain,
  onMenu,
}: { mode: string; guest: boolean } & Pick<Common, 'busy' | 'onAgain' | 'onMenu'>) {
  return (
    <div className="fz-btns">
      <button
        type="button"
        className="fz-btn"
        disabled={busy}
        onClick={onAgain}
        data-sfx="start"
        data-testid="final-again"
      >
        {busy ? 'Preparando…' : 'Jogar de novo'}
      </button>
      {!guest && (
        <Link
          to="/ranking"
          search={{ jogo: 'blocks', modo: mode as 'classic' | 'towers' }}
          className="fz-btn is-ghost"
          data-sfx="select"
        >
          Ver ranking
        </Link>
      )}
      <button
        type="button"
        className="fz-btn is-ghost"
        onClick={onMenu}
        data-sfx="back"
        data-testid="final-menu"
      >
        Voltar ao menu
      </button>
    </div>
  );
}

/** O recorde: medidor do resultado contra o melhor do aparelho. */
function RecordMeter({
  score,
  best,
  before,
  isRecord,
  unit,
}: {
  score: number;
  best: number;
  before: number;
  isRecord: boolean;
  unit: string;
}) {
  const pct = best > 0 ? Math.round((score / best) * 100) : 0;
  return (
    <div className="bkx-record">
      <div className="fz-meter" role="img" aria-label={`${pct}% do seu recorde`}>
        <i style={{ transform: `scaleX(${Math.min(1, pct / 100)})` }} />
      </div>
      <span>
        {isRecord
          ? before > 0
            ? `+${n(score - before)} ${unit} sobre o recorde anterior (${n(before)})`
            : 'O primeiro resultado neste modo: já é o seu recorde'
          : `${pct}% do seu recorde (${n(best)})`}
      </span>
    </div>
  );
}

/** Fim do Block Classic: pontos, recorde e o que fez a partida (linhas, combos, joinhas e PERFECTs). */
export function BlocksFinal({
  end,
  before,
  run,
  busy,
  onAgain,
  onMenu,
}: Common & { end: BlocksEnd }) {
  const [save, retry] = useSaveBlocks(run, 'classic', end.moves);
  const score = end.result.score;
  const guest = save === 'guest';
  // Sem conta não há recorde: só o resultado desta partida.
  const isRecord = !guest && score > before;
  const best = Math.max(score, before);
  const shown = useCountUp(score, 450, 1000);
  const perMove = end.result.moves > 0 ? Math.round(score / end.result.moves) : 0;
  const tone: FinalTone = isRecord ? 'win' : 'draw';
  return (
    <FinalShell
      theme="bkc"
      tone={tone}
      kicker="Block's · Block Classic · fim de partida"
      title={isRecord ? (before > 0 ? 'Novo recorde!' : 'Primeiro recorde!') : 'Sem espaço'}
      sub={
        isRecord
          ? `${n(score)} pontos. Ninguém limpou tanto aqui.`
          : 'Nenhuma das peças que sobraram cabe no tabuleiro.'
      }
      label="Resultado do Block Classic"
      testId="bkx-final"
      deco={<FallingBlocks />}
      footer={<Footer mode="classic" guest={guest} busy={busy} onAgain={onAgain} onMenu={onMenu} />}
    >
      <div className="bkx-cols">
        <div className="bkx-col">
          <section className="bkx-hero" aria-label="Pontuação">
            <span className="bkx-label">Pontos</span>
            <b className="bkx-big" data-testid="bkx-score">
              {n(shown)}
            </b>
            {!guest && (
              <RecordMeter
                score={score}
                best={best}
                before={before}
                isRecord={isRecord}
                unit="pontos"
              />
            )}
          </section>

          <div className="bkx-praise">
            <div className="bkx-seal" style={d(0)}>
              <ThumbSeal size={54} />
              <b>{end.thumbs}</b>
              <span>Joinhas</span>
            </div>
            <div className="bkx-seal is-perfect" style={d(1)}>
              <i aria-hidden="true">P</i>
              <b>{end.perfects}</b>
              <span>Perfect</span>
            </div>
          </div>
        </div>
        <div className="bkx-col">
          <ul className="fz-stats" aria-label="Resumo da partida">
            <li style={d(2)}>
              <small>Linhas limpas</small>
              <b>{end.result.lines}</b>
              <span>no total</span>
            </li>
            <li style={d(3)}>
              <small>Maior combo</small>
              <b>x{end.result.bestStreak}</b>
              <span>limpezas seguidas</span>
            </li>
            <li style={d(4)}>
              <small>Jogadas</small>
              <b>{end.result.moves}</b>
              <span>{perMove > 0 ? `${n(perMove)} pontos por jogada` : 'peças colocadas'}</span>
            </li>
            <li style={d(5)}>
              <small>Dicas usadas</small>
              <b>{end.hintsUsed}/3</b>
              <span>{end.hintsUsed === 0 ? 'sem ajuda' : 'ajudas pedidas'}</span>
            </li>
            {!guest && (
              <li style={d(6)}>
                <small>Seu recorde</small>
                <b>{n(best)}</b>
                <span>
                  {isRecord ? 'é este aqui' : before > 0 ? 'ainda de pé' : 'ainda não há'}
                </span>
              </li>
            )}
          </ul>

          <SaveNote className="mono bkx-note" save={save} onRetry={retry} />
        </div>
      </div>
    </FinalShell>
  );
}

/** Fim do Block Tower: peças empilhadas, recorde e o resumo da torre (tempo, magias, quedas). */
export function TowersFinal({
  end,
  before,
  run,
  busy,
  onAgain,
  onMenu,
}: Common & { end: TowersEnd }) {
  const [save, retry] = useSaveBlocks(run, 'towers', end.moves);
  const score = end.score;
  const guest = save === 'guest';
  const isRecord = !guest && score > before;
  const best = Math.max(score, before);
  const shown = useCountUp(score, 450, 1000);
  const perMin = end.time > 0 ? Math.round((score / end.time) * 60) : 0;
  const kept = end.pieces > 0 ? Math.round((score / end.pieces) * 100) : 0;
  const tone: FinalTone = isRecord ? 'win' : 'lose';
  const fell = end.collapses > 0;
  return (
    <FinalShell
      theme="twr"
      tone={tone}
      kicker="Block's · Block Tower · fim de partida"
      title={
        isRecord
          ? before > 0
            ? 'Torre recorde!'
            : 'Primeira torre!'
          : fell
            ? 'A torre desabou'
            : 'Sem vidas'
      }
      sub={
        isRecord
          ? `${n(score)} peças de pé. A mais alta até agora.`
          : fell
            ? 'Mais cuidado no equilíbrio, ou use a vinha e o cimento.'
            : 'Peças demais caíram da torre. Procure apoios largos e planos.'
      }
      label="Resultado do Block Tower"
      testId="twx-final"
      deco={<GrowingTower />}
      footer={<Footer mode="towers" guest={guest} busy={busy} onAgain={onAgain} onMenu={onMenu} />}
    >
      <div className="bkx-cols">
        <div className="bkx-col">
          <section className="bkx-hero" aria-label="Altura da torre">
            <span className="bkx-label">Peças empilhadas</span>
            <b className="bkx-big" data-testid="twx-score">
              {n(shown)}
            </b>
            {!guest && (
              <RecordMeter
                score={score}
                best={best}
                before={before}
                isRecord={isRecord}
                unit="peças"
              />
            )}
          </section>
        </div>
        <div className="bkx-col">
          <ul className="fz-stats" aria-label="Resumo da torre">
            <li style={d(0)}>
              <small>Tempo de jogo</small>
              <b>{clock(end.time)}</b>
              <span>{perMin > 0 ? `${perMin} peças por minuto` : 'até o fim'}</span>
            </li>
            <li style={d(1)}>
              <small>Peças jogadas</small>
              <b>{end.pieces}</b>
              <span>{end.pieces > 0 ? `${kept}% ficaram de pé` : 'nenhuma'}</span>
            </li>
            <li style={d(2)}>
              <small>Peças caídas</small>
              <b>{end.falls}</b>
              <span>{end.falls === 0 ? 'nenhuma caiu' : 'saíram da torre'}</span>
            </li>
            <li style={d(3)}>
              <small>Magias</small>
              <b>{end.spells}</b>
              <span>{end.spells === 0 ? 'sem magia' : 'usadas na torre'}</span>
            </li>
            <li style={d(4)}>
              <small>Caiu tudo</small>
              <b>{end.collapses}x</b>
              <span>{fell ? 'a torre inteira foi ao chão' : 'a torre aguentou'}</span>
            </li>
            {!guest && (
              <li style={d(5)}>
                <small>Seu recorde</small>
                <b>{n(best)}</b>
                <span>
                  {isRecord ? 'é este aqui' : before > 0 ? 'ainda de pé' : 'ainda não há'}
                </span>
              </li>
            )}
          </ul>

          <SaveNote className="mono bkx-note" save={save} onRetry={retry} />
        </div>
      </div>
    </FinalShell>
  );
}
