import { Component, useCallback, useEffect, useReducer, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { preloadImages } from './assets';
import { preloadSounds } from './audio';
import {
  CatsScreen, CfgScreen, CluesScreen, FinalScreen, GuessScreen, PlayersScreen, RankChip, RankSheet,
  RevealScreen, ResultScreen, ScoreScreen, TalkScreen, VoteScreen,
} from './screens';
import { initial, reducer, saveSetup, type Phase } from './state';
import { AskCtx, Confirm, Primary, RankSlot, type AskCfg } from './ui';
import './impostor.css';

const SCREENS = {
  players: PlayersScreen, cats: CatsScreen, cfg: CfgScreen, reveal: RevealScreen,
  clues: CluesScreen, talk: TalkScreen, vote: VoteScreen, result: ResultScreen, guess: GuessScreen,
  score: ScoreScreen, final: FinalScreen,
} as const;

/** Sem ranking na faixa onde a pessoa só vê o próprio segredo. */
const NO_RANK: Phase[] = ['reveal', 'vote', 'guess', 'final'];

/** Fases em que há partida em andamento: sair sem querer perderia o que foi feito. */
const IN_GAME: Phase[] = ['reveal', 'clues', 'talk', 'vote', 'result', 'guess'];

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
  const exit = () => void navigate({ to: '/mesa' });
  return (
    <div className="im-app" data-testid="im-app" data-phase={s.phase}>
      <div className="im-lamp" aria-hidden="true" />
      <AskCtx.Provider value={askRef}>
        <RankSlot.Provider value={NO_RANK.includes(s.phase) ? null : <RankChip s={s} onOpen={() => setRank(true)} />}>
          <Guard onReset={() => d({ type: 'reset' })}>
            <div key={`${s.phase}-${s.seen}-${s.voter}-${s.guessIdx}`} className={`im-view${s.back ? ' back' : ''}`}>
              <Screen s={s} d={d} exit={exit} />
            </div>
          </Guard>
        </RankSlot.Provider>
        {rank && <RankSheet s={s} onClose={() => setRank(false)} />}
        {ask && <Confirm cfg={ask} onClose={() => setAsk(null)} />}
      </AskCtx.Provider>
    </div>
  );
}
