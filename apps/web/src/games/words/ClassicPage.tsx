import { useState, type CSSProperties } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { PlayGate } from '@/components/PlayGate';
import { useAuth } from '@/lib/auth';
import { fetchStats } from '@/lib/stats';
import { ClassicArt, MiniBoards } from './words-art';
import { Pill, RulesList, WordsShell } from './words-kit';
import { fetchDaily, fetchModes, MODE_LABEL, type ClassicMode } from './words-api';

const MODES: ClassicMode[] = ['classic', 'dueto', 'quarteto'];

const RULES = [
  'Digite uma palavra de 5 letras e aperte Enter. Ela precisa existir na lista do jogo.',
  'Verde: letra no lugar certo. Amarelo: a letra existe, mas em outro lugar. Cinza: não existe (ou já foi usada).',
  'No Dueto e no Quarteto o mesmo palpite vale para todos os tabuleiros; o resolvido trava.',
  'Acentos não importam: digite "aviao" e o jogo mostra "avião".',
  'A partida fica salva: saia e volte quando quiser. Ao terminar, a próxima palavra já é sorteada.',
];

/** A página do Classic Word's: os modos de 1, 2 e 4 palavras em destaque e o Daily como botão chamativo. */
export function ClassicPage() {
  const user = useAuth((s) => s.user);
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
        <section className="cw-gold" data-testid="daily-card">
          <span className="cw-gold-tab">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1l2.1 4.6 5 .6-3.7 3.4 1 5L8 12.1 3.6 14.6l1-5L.9 6.2l5-.6z" />
            </svg>
            Daily
          </span>
          <span className="cw-gold-shine" aria-hidden="true" />
          <i className="cw-spark s1" aria-hidden="true" />
          <i className="cw-spark s2" aria-hidden="true" />
          <i className="cw-spark s3" aria-hidden="true" />
          <div className="cw-gold-head">
            <div>
              <b>Palavra do dia #{daily.data?.number ?? ''}</b>
              <span className="mono">{done ? 'Concluído hoje' : 'Uma por dia, igual para todos'}</span>
            </div>
            {streak && <Pill tone="paper">Sequência {streak.current}</Pill>}
          </div>
          {done ? (
            <div className="cw-gold-done">
              <b>Nota {(run!.nota ?? 0).toFixed(1).replace('.', ',')}</b>
              <span className="mono">
                {run!.used} de {run!.tries} tentativas · a próxima palavra sai à meia-noite
              </span>
            </div>
          ) : (
            <Link to="/words/classic/jogar" search={{ tipo: 'daily', modo: 'classic' }} className="cw-gold-cta" data-sfx="start" data-testid="play-daily">
              <span>{run ? 'Continuar o Daily' : 'Jogar o Daily'}</span>
              <i aria-hidden="true">→</i>
            </Link>
          )}
          <Link to="/ranking" search={{ jogo: 'wclassic', modo: 'daily' }} className="cw-gold-rank">
            Ver o ranking do Daily →
          </Link>
        </section>

        <h3 className="wd-section">Jogar quando quiser</h3>
        <div className="cw-modes">
          {MODES.map((m, i) => {
            const info = MODE_LABEL[m];
            const s = modes.data?.[m];
            return (
              <Link
                key={m}
                to="/words/classic/jogar"
                search={{ tipo: 'solo', modo: m }}
                className={`cw-modecard m${info.words}`}
                style={{ '--i': i } as CSSProperties}
                data-sfx="start"
                data-testid={`mode-${m}`}
              >
                <div className="cw-modecard-art">
                  <MiniBoards count={info.words as 1 | 2 | 4} />
                </div>
                <div className="cw-modecard-body" data-testid={`mode-card-${m}`}>
                  <b>{info.name}</b>
                  <span className="mono">
                    {s?.open ? `Em andamento · ${s.open.used} de ${s.open.tries}` : `${info.tries} tentativas`}
                  </span>
                  {s && s.played > 0 && (
                    <span className="mono cw-modecard-stats">
                      {s.won} vitória{s.won === 1 ? '' : 's'} em {s.played}
                    </span>
                  )}
                </div>
                <span className="cw-modecard-go">{s?.open ? 'Continuar' : 'Jogar'}</span>
              </Link>
            );
          })}
        </div>
        <p className="mono cw-note">Sem ranking. A partida fica salva e, ao terminar, a próxima palavra já é sorteada.</p>

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
