import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { PlayGate } from '@/components/PlayGate';
import { useAuth } from '@/lib/auth';
import { fetchStats } from '@/lib/stats';
import { ClassicArt, MiniBoards } from './words-art';
import { Pill, RulesList, Tabs, WordsShell } from './words-kit';
import { fetchDaily, fetchModes, MODE_LABEL, type ClassicMode } from './words-api';

type Tab = 'daily' | ClassicMode;

const RULES = [
  'Digite uma palavra de 5 letras e aperte Enter. Ela precisa existir na lista do jogo.',
  'Verde: letra no lugar certo. Amarelo: a letra existe, mas em outro lugar. Cinza: não existe (ou já foi usada).',
  'No Dueto e no Quarteto o mesmo palpite vale para todos os tabuleiros; o resolvido trava.',
  'Acentos não importam: digite "aviao" e o jogo mostra "avião".',
  'A partida fica salva: saia e volte quando quiser. Ao terminar, a próxima palavra já é sorteada.',
];

/** A página do Classic Word's: abas Daily, 1, 2 e 4 palavras, com as partidas salvas de cada modo. */
export function ClassicPage() {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<Tab>('daily');
  const [rules, setRules] = useState(false);
  const daily = useQuery({ queryKey: ['words', 'daily'], queryFn: fetchDaily, enabled: !!user, retry: false });
  const modes = useQuery({ queryKey: ['words', 'modes'], queryFn: fetchModes, enabled: !!user, retry: false, refetchOnMount: 'always' });
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user, retry: false });
  const streak = stats.data?.daily.wclassic;
  const run = daily.data?.run;
  const done = !!run && run.state !== 'open';

  return (
    <WordsShell title="Classic Word's" accent="green" className="cw-theme">
      <section className="wd-banner">
        <div className="wd-banner-art">
          <ClassicArt />
        </div>
        <div>
          <h2>Descubra a palavra</h2>
          <p>5 letras. Verde: lugar certo. Amarelo: existe, mas em outro lugar.</p>
        </div>
      </section>

      <PlayGate what="jogar">
        <Tabs
          label="Modos"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'daily', label: 'Daily' },
            { id: 'classic', label: '1 palavra' },
            { id: 'dueto', label: '2 palavras' },
            { id: 'quarteto', label: '4 palavras' },
          ]}
        />

        {tab === 'daily' ? (
          <section className="wd-panel daily" data-testid="daily-card">
            <div className="wd-panel-head">
              <h3>Daily{daily.data ? ` #${daily.data.number}` : ''}</h3>
              {streak && <Pill tone="paper">Sequência {streak.current}</Pill>}
            </div>
            {done ? (
              <>
                <div className="mono">
                  Você já jogou hoje · nota {(run!.nota ?? 0).toFixed(1).replace('.', ',')} · {run!.used} de {run!.tries} tentativas
                </div>
                <div className="mono">A próxima palavra sai à meia-noite.</div>
              </>
            ) : (
              <>
                <div className="mono">
                  {run ? `Em andamento · ${run.used} de ${run.tries} tentativas` : 'Uma palavra por dia, igual para todos · 6 tentativas'}
                </div>
                <Link to="/words/classic/jogar" search={{ tipo: 'daily', modo: 'classic' }} className="btn alt" data-sfx="start" data-testid="play-daily">
                  {run ? 'Continuar o Daily' : 'Jogar o Daily'}
                </Link>
              </>
            )}
            <Link to="/ranking" search={{ jogo: 'wclassic', modo: 'daily' }} className="wd-link">
              <span>
                Ranking do Daily
                <small>Só o Daily conta para o ranking</small>
              </span>
              <i>→</i>
            </Link>
          </section>
        ) : (
          (() => {
            const info = MODE_LABEL[tab];
            const m = modes.data?.[tab];
            return (
              <section className="wd-panel cw-mode" data-testid={`mode-card-${tab}`}>
                <div className="cw-mode-art">
                  <MiniBoards count={info.words as 1 | 2 | 4} />
                </div>
                <div className="wd-panel-head">
                  <h3>{info.name}</h3>
                  <Pill tone="paper">{info.tries} tentativas</Pill>
                </div>
                <div className="mono">
                  {m?.open
                    ? `Em andamento · ${m.open.used} de ${m.open.tries} tentativas`
                    : `${info.words === 1 ? 'Uma palavra' : `${info.words} palavras ao mesmo tempo`}. Jogue quando quiser.`}
                </div>
                {m && (
                  <div className="cw-mode-stats mono">
                    <span>
                      <b>{m.played}</b> jogadas
                    </span>
                    <span>
                      <b>{m.won}</b> vitórias
                    </span>
                  </div>
                )}
                <Link
                  to="/words/classic/jogar"
                  search={{ tipo: 'solo', modo: tab }}
                  className="btn alt"
                  data-sfx="start"
                  data-testid={`mode-${tab}`}
                >
                  {m?.open ? 'Continuar' : 'Jogar'}
                </Link>
                <div className="mono cw-note">Sem ranking. A partida fica salva e, ao terminar, a próxima palavra já é sorteada.</div>
              </section>
            );
          })()
        )}
      </PlayGate>

      <button type="button" className="wd-toggle" aria-expanded={rules} onClick={() => setRules((r) => !r)} data-testid="toggle-rules">
        Como jogar <i>{rules ? '−' : '+'}</i>
      </button>
      {rules && (
        <section className="wd-panel">
          <RulesList steps={RULES} />
        </section>
      )}
    </WordsShell>
  );
}
