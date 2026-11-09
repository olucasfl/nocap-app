import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { decodePattern, type ClassicMode } from '@nocap/games';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { MuteButton } from '@/components/MuteButton';
import { useAuth } from '@/lib/auth';
import { fetchStats } from '@/lib/stats';
import { classicProgress, levelView, CLASSIC_KEYS } from './classic-engine';
import { loadClassicLevels, tierOf, tierRanges, type ClassicLevel } from './levels/levels';
import { useProgress, type LevelStatus } from './levels/progress';
import { fetchDaily, MODE_LABEL } from './words-api';
import meta from './levels/meta.json';
import { formatCountdown, secondsToBrasiliaMidnight, useNextWordCountdown } from '@/lib/daily-countdown';
import { LevelBrowser, type BrowserCell } from './landing/LevelBrowser';
import { WlBtn, WlMeter, WlPanel, WordsLanding } from './landing/WordsLanding';
import './classic-levels.css';

const MODES: ClassicMode[] = ['classic', 'dueto', 'quarteto'];
const TOTALS: Record<ClassicMode, number> = {
  classic: meta.classic.c,
  dueto: meta.classic.d,
  quarteto: meta.classic.q,
};
const TITLE: Record<ClassicMode, string> = {
  classic: '1 Palavra',
  dueto: '2 Palavras',
  quarteto: '4 Palavras',
};

export { secondsToBrasiliaMidnight, formatCountdown };

export const CLASSIC_STEPS = [
  'Digite uma palavra de 5 letras e aperte Enter. Ela precisa existir na lista do jogo.',
  'Cada letra mostra uma cor. Use as cores para chegar na palavra certa.',
  'Letra repetida: cada letra da resposta só pinta uma casa (igual ao Wordle e ao Termo).',
  'No teclado, a letra cinza clara riscada "já foi": não tem na palavra. Você ainda pode usar ela para testar palavras e eliminar outras.',
  'Acentos não importam: digite "aviao" e o jogo mostra "avião".',
  'No Dueto (2 palavras) e no Quarteto (4 palavras) o mesmo palpite vale para todos os tabuleiros.',
  'O Daily é uma palavra por dia, igual para todo mundo, e vale para o ranking. As fases são livres: jogue no seu ritmo, o progresso fica salvo neste aparelho.',
];

type Screen = 'main' | 'daily' | 'rules' | 'settings' | ClassicMode;
const isMode = (s: string | undefined): s is ClassicMode =>
  s === 'classic' || s === 'dueto' || s === 'quarteto';

/** A tela própria do Classic Word's: Daily, 1, 2 e 4 palavras, como jogar e configurações (spec 065). */
export function ClassicLanding({ start }: { start?: string }) {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const [screen, setScreen] = useState<Screen>(
    isMode(start) ? start : start === 'daily' ? 'daily' : 'main',
  );
  const progress = {
    classic: useProgress(classicProgress.classic),
    dueto: useProgress(classicProgress.dueto),
    quarteto: useProgress(classicProgress.quarteto),
  };
  const daily = useQuery({
    queryKey: ['words', 'daily'],
    queryFn: fetchDaily,
    enabled: !!user,
    retry: false,
  });
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    enabled: !!user,
    retry: false,
  });
  const [all, setAll] = useState<Record<string, ClassicLevel[]> | null>(null);
  const mode = isMode(screen) ? screen : null;

  // os dados das fases só são baixados quando alguém abre um modo
  useEffect(() => {
    if (mode && !all)
      void loadClassicLevels().then((l) => setAll(l as unknown as Record<string, ClassicLevel[]>));
  }, [mode, all]);

  const levels = mode && all ? all[CLASSIC_KEYS[mode]]! : null;
  const cells = useMemo(() => {
    if (!mode || !levels) return null;
    const prog = progress[mode];
    return levels.map((lv, i): BrowserCell & { at: number; used: number; tries: number } => {
      const p = prog[String(i + 1)];
      if (!p || (p.guesses.length === 0 && !p.gaveUp))
        return {
          n: i + 1,
          status: 'new',
          label: `Fase ${i + 1}: nova`,
          at: 0,
          used: 0,
          tries: MODE_LABEL[mode].tries,
        };
      const v = levelView(mode, lv, i + 1, p.guesses, p.gaveUp ?? false);
      const status: LevelStatus = v.state === 'open' ? 'open' : 'done';
      return {
        n: i + 1,
        status,
        tone: status === 'done' && v.state !== 'won' ? 'lost' : undefined,
        sub:
          status === 'open'
            ? `${v.used}/${v.tries}`
            : v.state === 'won'
              ? `${v.used}/${v.tries}`
              : 'desistiu',
        label: `Fase ${i + 1}: ${status === 'open' ? 'em andamento' : v.state === 'won' ? `completa em ${v.used} tentativas` : 'desistência'}`,
        at: p.at ?? 0,
        used: v.used,
        tries: v.tries,
      };
    });
  }, [mode, levels, mode && progress[mode]]);

  const back = () => (screen === 'main' ? void navigate({ to: '/words' }) : setScreen('main'));
  const go = (n: number) =>
    void navigate({ to: '/words/classic/fase/$modo/$n', params: { modo: mode!, n: String(n) } });
  const goDaily = () =>
    void navigate({ to: '/words/classic/jogar', search: { tipo: 'daily', modo: 'classic' } });
  const goRank = () =>
    void navigate({ to: '/ranking', search: { jogo: 'wclassic', modo: 'daily' } });

  const untilNext = useNextWordCountdown(() => void daily.refetch());
  const run = daily.data?.run;
  const dailyDone = !!run && run.state !== 'open';
  const dailySub = !user
    ? 'entre para jogar'
    : daily.isLoading
      ? '...'
      : dailyDone
        ? 'concluído hoje'
        : run && run.used > 0
          ? 'em andamento'
          : 'ainda não jogou';
  const count = (m: ClassicMode) => {
    const vals = Object.values(progress[m]);
    return {
      done: vals.filter((p) => p.done).length,
      open: vals.filter((p) => !p.done && p.guesses.length > 0).length,
    };
  };

  let left;
  let right;
  if (screen === 'main') {
    left = (
      <nav className="gx-menu" aria-label="Menu do Classic Word's" data-testid="wl-main">
        <WlBtn
          main
          title="Daily"
          sub={dailySub}
          onClick={() => setScreen('daily')}
          sfx="start"
          testid="menu-daily"
        />
        {MODES.map((m) => {
          const c = count(m);
          return (
            <WlBtn
              key={m}
              title={TITLE[m]}
              sub={`${TOTALS[m]} fases${c.done + c.open > 0 ? ` · ${c.done} completas` : ''}`}
              onClick={() => setScreen(m)}
              testid={`mode-${m}`}
            />
          );
        })}
        <WlBtn
          title="Como jogar"
          sub="cores e regras"
          onClick={() => setScreen('rules')}
          testid="menu-rules"
        />
        <WlBtn
          title="Configurações"
          sub="som do jogo"
          onClick={() => setScreen('settings')}
          testid="menu-settings"
        />
        <div className="gx-gap" />
        <WlBtn danger title="Voltar aos Word's" onClick={back} sfx="back" testid="wl-exit" />
      </nav>
    );
  } else if (screen === 'daily') {
    const rows = run?.guesses ?? [];
    const tries = run?.tries ?? MODE_LABEL.classic.tries;
    const streak = stats.data?.daily.wclassic;
    left = (
      <WlPanel
        title="Daily"
        lead="Uma palavra por dia, igual para todo mundo."
        onBack={back}
        testid="daily-card"
      >
        {!user ? (
          <>
            <div className="wl-state">
              <b>Entre para jogar o Daily</b>
              <span>
                Só quem tem conta joga: assim sua sequência e seu lugar no ranking ficam guardados.
              </span>
            </div>
            <div className="wl-login">
              <button
                type="button"
                className="gx-enter"
                onClick={() => void navigate({ to: '/entrar' })}
              >
                Entrar
              </button>
              <button
                type="button"
                className="gx-enter"
                onClick={() => void navigate({ to: '/criar-conta' })}
              >
                Criar conta
              </button>
            </div>
          </>
        ) : daily.isLoading ? (
          <div className="wl-state">
            <b>Carregando...</b>
          </div>
        ) : daily.isError || !daily.data ? (
          <div className="wl-state lost" role="alert">
            <b>Não deu para abrir o Daily</b>
            <span>Confira sua conexão e tente de novo.</span>
            <button type="button" className="wl-link" onClick={() => void daily.refetch()}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <>
            <div
              className={`wl-state${dailyDone ? (run!.state === 'won' ? ' won' : ' lost') : ''}`}
            >
              <span className="wl-badge">Palavra do dia #{daily.data.number}</span>
              {dailyDone ? (
                <>
                  <b>{run!.state === 'won' ? `Acertou em ${run!.used}` : 'Não foi dessa vez'}</b>
                  <span>
                    Concluído hoje · {run!.used} de {run!.tries} tentativas · a próxima palavra sai
                    à meia-noite.
                  </span>
                </>
              ) : run && run.used > 0 ? (
                <>
                  <b>Em andamento</b>
                  <span>
                    {run.used} de {run.tries} tentativas usadas. Falta pouco!
                  </span>
                </>
              ) : (
                <>
                  <b>Ainda não jogou hoje</b>
                  <span>{tries} tentativas para achar a palavra.</span>
                </>
              )}
            </div>
            <div
              className="wl-next"
              data-testid="daily-countdown"
              role="timer"
              aria-label="Tempo até a próxima palavra"
            >
              <small>{dailyDone ? 'Próxima palavra em' : 'A palavra de hoje acaba em'}</small>
              <b>FALTA {formatCountdown(untilNext)}</b>
            </div>
            {streak && (
              <div className="wl-nums" data-testid="daily-streak">
                <span>
                  <b>{streak.current}</b> dias seguidos
                </span>
                <span>
                  melhor sequência <b>{streak.best}</b>
                </span>
              </div>
            )}
            {!dailyDone && (
              <button
                type="button"
                className="wl-cta"
                onClick={goDaily}
                data-sfx="start"
                data-testid="play-daily"
              >
                <span>{run && run.used > 0 ? 'Continuar o Daily' : 'Jogar o Daily'}</span>
                <small>→</small>
              </button>
            )}
            <button type="button" className="wl-link" onClick={goRank} data-testid="daily-rank">
              Ver o ranking do Daily →
            </button>
          </>
        )}
      </WlPanel>
    );
    right = (
      <div className="wl-board" data-testid="daily-board">
        <h3>
          {dailyDone
            ? 'Seu jogo de hoje'
            : rows.length > 0
              ? 'Seu jogo até agora'
              : 'Seu tabuleiro'}
        </h3>
        <div className="wl-show-board" data-testid={rows.length > 0 ? 'daily-rows' : undefined}>
          {Array.from({ length: tries }, (_, r) => {
            const g = rows[r];
            const cells = g ? decodePattern(run!.boards[0]!.rows[r]!) : [];
            return (
              <div key={r} className="wl-show-row">
                {Array.from({ length: 5 }, (_, c) => (
                  <span
                    key={c}
                    className={`wl-tile ${g ? cells[c] : 'empty hint'}`}
                    style={{ '--i': r * 5 + c } as CSSProperties}
                  >
                    {g ? g[c] : ''}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
        {dailyDone && run!.answers?.[0] ? (
          <div data-testid="daily-word">
            <p>A palavra era</p>
            <div
              className="wl-answer"
              aria-label={`A palavra era ${run!.answers[0].toUpperCase()}`}
            >
              {[...run!.answers[0]].map((ch, i) => (
                <span key={i} className="wl-tile hit">
                  {ch}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p>
            {user
              ? rows.length > 0
                ? 'As cores aparecem como na partida.'
                : 'Seus palpites de hoje aparecem aqui.'
              : 'Entre para jogar e ver seu tabuleiro aqui.'}
          </p>
        )}
      </div>
    );
  } else if (mode && screen !== 'rules') {
    const info = MODE_LABEL[mode];
    const total = TOTALS[mode];
    const c = count(mode);
    const open = cells?.filter((x) => x.status === 'open').sort((a, b) => b.at - a.at)[0];
    const next = cells?.find((x) => x.status === 'new');
    const pick = open ?? next;
    left = (
      <WlPanel
        title={TITLE[mode]}
        lead={`${total} fases do mais fácil ao mais difícil · ${info.tries} tentativas em cada.`}
        onBack={back}
        testid={`mode-panel-${mode}`}
      >
        <WlMeter done={c.done} open={c.open} total={total} doneLabel="completas" />
        {pick && (
          <button
            type="button"
            className="wl-cta"
            onClick={() => go(pick.n)}
            data-sfx="start"
            data-testid="continue"
          >
            <span>
              {open ? 'Continuar' : 'Começar'} fase {pick.n}
            </span>
            <small>{open ? `${open.used} de ${open.tries}` : tierOf(levels![pick.n - 1]!)}</small>
          </button>
        )}
        <p className="lead">Escolha qualquer fase logo abaixo.</p>
      </WlPanel>
    );
    right =
      cells && levels ? (
        <LevelBrowser
          title={`Fases de ${TITLE[mode]}`}
          cells={cells}
          tiers={tierRanges(levels)}
          go={go}
        />
      ) : (
        <div className="wl-board" role="status">
          <h3>Carregando as fases...</h3>
        </div>
      );
  } else if (screen === 'rules') {
    left = (
      <WlPanel title="Como jogar" onBack={back} testid="rules">
        <div className="wl-scroll">
          <ul className="wl-legend-list" aria-label="Significado das cores">
            <li>
              <span className="wl-tile hit">A</span> Letra no lugar certo
            </li>
            <li>
              <span className="wl-tile near">M</span> Tem a letra, mas em outro lugar
            </li>
            <li>
              <span className="wl-tile miss">B</span> Não tem essa letra
            </li>
          </ul>
          <p className="lead">
            Palavra AMIGO, tentativa AMBOS: A e M no lugar certo, O existe mas em outro lugar, B e S
            não existem.
          </p>
          <ol className="wl-rules">
            {CLASSIC_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      </WlPanel>
    );
  } else {
    left = (
      <WlPanel title="Configurações" onBack={back} testid="wl-settings">
        <div className="gx-row">
          <span>Som do jogo</span>
          <MuteButton />
        </div>
        <p className="lead">
          Seu progresso nas fases fica salvo neste aparelho. O Daily fica salvo na sua conta.
        </p>
      </WlPanel>
    );
  }

  return (
    <WordsLanding
      game="classic"
      screen={screen}
      onBack={back}
      left={left}
      right={right}
      pane={mode && screen !== 'rules' ? 'levels' : 'show'}
    />
  );
}
