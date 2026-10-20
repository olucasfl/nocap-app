import { useState, type CSSProperties } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { PlayGate } from '@/components/PlayGate';
import { useAuth } from '@/lib/auth';
import { fetchStats } from '@/lib/stats';
import { MiniBoards } from './words-art';
import { ColorLegend, Pill, RulesList, Tabs, WordsShell } from './words-kit';
import { fetchDaily, fetchModes, MODE_LABEL, type ClassicMode } from './words-api';

const MODES: ClassicMode[] = ['classic', 'dueto', 'quarteto'];

const STEPS = [
  'Digite uma palavra de 5 letras e aperte Enter. Ela precisa existir na lista do jogo.',
  'Cada letra mostra uma cor. Use as cores para chegar na palavra certa.',
  'Letra repetida: cada letra da resposta só pinta uma casa (igual ao Wordle e ao Termo).',
  'Letras cinza não existem na palavra: o teclado bloqueia elas.',
  'Acentos não importam: digite "aviao" e o jogo mostra "avião".',
  'No Dueto e no Quarteto o mesmo palpite vale para todos os tabuleiros.',
];

/** A página do Classic Word's: os modos de 1, 2 e 4 palavras em destaque e o Daily como botão chamativo. */
export function ClassicPage() {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<'jogar' | 'regras'>('jogar');
  const daily = useQuery({ queryKey: ['words', 'daily'], queryFn: fetchDaily, enabled: !!user, retry: false });
  const modes = useQuery({ queryKey: ['words', 'modes'], queryFn: fetchModes, enabled: !!user, retry: false, refetchOnMount: 'always' });
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, enabled: !!user, retry: false });
  const streak = stats.data?.daily.wclassic;
  const run = daily.data?.run;
  const done = !!run && run.state !== 'open';

  return (
    <WordsShell title="Classic Word's" accent="green" className="cw-theme">
      <Tabs
        label="Seções"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'jogar', label: 'Jogar' },
          { id: 'regras', label: 'Como jogar' },
        ]}
      />

      {tab === 'regras' ? (
        <section className="wd-panel cw-howto" data-testid="rules">
          <h3>As cores</h3>
          <ColorLegend big />
          <div className="cw-example" aria-label="Exemplo: a palavra é AMIGO e você tentou AMBOS">
            {[...'AMBOS'].map((ch, i) => (
              <span key={i} className={`cw-ex ${['hit', 'hit', 'miss', 'near', 'miss'][i]}`}>
                {ch}
              </span>
            ))}
          </div>
          <p className="mono cw-example-note">Palavra: AMIGO. Tentativa: AMBOS: A e M no lugar certo, O existe mas em outro lugar, B e S não existem.</p>
          <h3>Regras</h3>
          <RulesList steps={STEPS} />
        </section>
      ) : (
      <PlayGate what="jogar">
        <section className="cw-gold" data-testid="daily-card">
          <span className="cw-gold-tab">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1l2.1 4.6 5 .6-3.7 3.4 1 5L8 12.1 3.6 14.6l1-5L.9 6.2l5-.6z" />
            </svg>
            Daily
          </span>
          <span className="cw-gold-shine" aria-hidden="true" />
          <div className="cw-gold-head">
            <div>
              <b>Palavra do dia #{daily.data?.number ?? ''}</b>
              <span className="mono">{done ? 'Concluído hoje' : 'Uma por dia, igual para todos'}</span>
            </div>
            {streak && <Pill tone="paper">Sequência {streak.current}</Pill>}
          </div>
          {done ? (
            <div className="cw-gold-done">
              <b>{run!.state === 'won' ? `Acertou em ${run!.used}` : 'Não foi dessa vez'}</b>
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

        <h3 className="wd-section">Ou jogue sem pressa</h3>
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
                    {s?.open ? `Em andamento ${s.open.used}/${s.open.tries}` : `${info.tries} tentativas`}
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
      </PlayGate>

      )}
    </WordsShell>
  );
}
