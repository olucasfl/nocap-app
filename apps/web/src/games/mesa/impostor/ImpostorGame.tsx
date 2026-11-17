import { Component, useCallback, useEffect, useReducer, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { preloadImages } from './assets';
import { preloadSounds } from './audio';
import {
  CatsScreen, CfgScreen, CluesScreen, FinalScreen, GuessResScreen, GuessScreen, PlayersScreen, RankChip, RankSheet,
  RevealScreen, ResultScreen, ScoreScreen, TalkScreen, VoteScreen,
} from './screens';
import { initial, reducer, saveSetup, type Phase, type State } from './state';
import { AskCtx, Confirm, Primary, RankSlot, type AskCfg } from './ui';
import './impostor.css';

const SCREENS = {
  players: PlayersScreen, cats: CatsScreen, cfg: CfgScreen, reveal: RevealScreen,
  clues: CluesScreen, talk: TalkScreen, vote: VoteScreen, result: ResultScreen, guess: GuessScreen, guessres: GuessResScreen,
  score: ScoreScreen, final: FinalScreen,
} as const;

/** Sem ranking na faixa onde a pessoa só vê o próprio segredo. */
const NO_RANK: Phase[] = ['reveal', 'vote', 'guess', 'guessres', 'final'];

/** Fases em que há partida em andamento: sair sem querer perderia o que foi feito. */
const IN_GAME: Phase[] = ['reveal', 'clues', 'talk', 'vote', 'result', 'guess', 'guessres'];

/** Cartela de transição entre momentos do jogo: título grande, rápido, sem exagero. */
function splashFor(s: State): { key: string; title: string; sub: string } | null {
  const wrong = s.round?.mode === 'wrong';
  if (s.phase === 'reveal' && s.seen === 0) return { key: `reveal-${s.game}`, title: `${s.game + 1}ª partida`, sub: 'Cada um vai ver o seu papel' };
  if (s.phase === 'clues' && s.clueStep === 'say') return { key: `say-${s.game}-${s.clueRound}`, title: wrong ? 'Hora de responder' : 'Hora de dizer', sub: wrong ? 'Uma resposta de cada um' : 'Uma palavra de cada um' };
  if (s.phase === 'talk') return { key: `talk-${s.game}`, title: 'Debate', sub: 'Conversem e descubram' };
  if (s.phase === 'vote' && s.voter === 0 && s.voteStep === 'pass') return { key: `vote-${s.game}`, title: 'Hora de votar', sub: 'Em segredo, um de cada vez' };
  if (s.phase === 'score') return { key: `score-${s.game}`, title: 'Ranking', sub: 'Os pontos desta partida' };
  return null;
}

const SPLASH_MS = 1500;

/** Se algo quebrar, a pessoa vê uma tela clara com saída (recomeçar), nunca uma tela em branco. */
class Guard extends Component<{ onReset: () => void; children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error('impostor', e, i.componentStack); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="im-screen im-centered" role="alert" data-testid="im-crash">
        <div className="im-body im-mid">
          <h2 className="im-t">Algo deu errado</h2>
          <p className="im-sub">A partida travou. Seus jogadores continuam salvos. Toque para recomeçar.</p>
        </div>
        <div className="im-foot"><Primary sound={null} onClick={() => { this.props.onReset(); this.setState({ err: false }); }}>Recomeçar</Primary></div>
      </div>
    );
  }
}

/** Impostor, modo Mesa (spec 088): o celular passa de mão em mão, tudo no aparelho, sem internet. */
export function ImpostorGame() {
  const navigate = useNavigate();
  const [s, d] = useReducer(reducer, undefined, initial);
  const [rank, setRank] = useState(false);
  const [ask, setAsk] = useState<AskCfg | null>(null);
  const askRef = useCallback((c: AskCfg) => setAsk(c), []);
  const live = useRef(false);
  live.current = IN_GAME.includes(s.phase);

  useEffect(() => {
    preloadImages();
    const first = () => preloadSounds();
    window.addEventListener('pointerdown', first, { once: true });
    return () => window.removeEventListener('pointerdown', first);
  }, []);
  useEffect(() => saveSetup(s), [s.players, s.settings]);

  // fechar a aba, atualizar ou voltar pelo navegador no meio da partida: pergunta antes
  useEffect(() => {
    const bye = (e: BeforeUnloadEvent) => {
      if (!live.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    const pop = () => {
      if (!live.current) return;
      history.pushState(null, '');
      setAsk({ title: 'Sair da partida?', text: 'Esta partida se perde e ninguém ganha pontos.', confirm: 'Sair da partida', cancel: 'Continuar jogando', danger: true, onConfirm: () => d({ type: 'leave' }) });
    };
    history.pushState(null, '');
    window.addEventListener('beforeunload', bye);
    window.addEventListener('popstate', pop);
    return () => {
      window.removeEventListener('beforeunload', bye);
      window.removeEventListener('popstate', pop);
    };
  }, []);

  const Screen = SCREENS[s.phase];
  const sp = splashFor(s);
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const noSplash = (() => { try { return localStorage.getItem('im-nosplash') === '1'; } catch { return false; } })();
  const showSplash = !!sp && sp.key !== doneKey && !noSplash;
  useEffect(() => {
    if (!sp || sp.key === doneKey) return undefined;
    const ms = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 700 : SPLASH_MS;
    const t = window.setTimeout(() => setDoneKey(sp.key), ms);
    return () => window.clearTimeout(t);
  }, [sp?.key, doneKey]);
  const exit = () => void navigate({ to: '/mesa' });
  return (
    <div className="im-app" data-testid="im-app" data-phase={s.phase}>
      <div className="im-lamp" aria-hidden="true" />
      <AskCtx.Provider value={askRef}>
        <RankSlot.Provider value={NO_RANK.includes(s.phase) ? null : <RankChip s={s} onOpen={() => setRank(true)} />}>
          <Guard onReset={() => d({ type: 'reset' })}>
            {showSplash && sp ? (
              <div className="im-splash" data-testid="im-splash" onClick={() => setDoneKey(sp.key)} key={sp.key}>
                <span className="im-splash-bar" aria-hidden="true" />
                <span className="im-splash-t" role="status">{sp.title}</span>
                <span className="im-splash-s">{sp.sub}</span>
              </div>
            ) : (
            <div key={`${s.phase}-${s.seen}-${s.voter}-${s.guessIdx}-${s.clueStep}-${s.clueRound}-${s.voteStep}-${s.resultStep}`} className={`im-view${s.back ? ' back' : ''}`}>
              <Screen s={s} d={d} exit={exit} />
            </div>
            )}
          </Guard>
        </RankSlot.Provider>
        {rank && <RankSheet s={s} onClose={() => setRank(false)} />}
        {ask && <Confirm cfg={ask} onClose={() => setAsk(null)} />}
      </AskCtx.Provider>
    </div>
  );
}
