import { Component, useCallback, useEffect, useReducer, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { preloadImages } from '../impostor/assets';
import { preloadSounds } from '../impostor/audio';
import { AskCtx, Confirm, Primary, type AskCfg } from '../impostor/ui';
import { AssignScreen, CatsScreen, CfgScreen, ChooseScreen, FinalScreen, JudgeScreen, ModeScreen, PassScreen, PickScreen, PlayScreen, ResultScreen, SidesScreen, StealScreen, fast } from './screens';
import { initial, reducer, saveSetup, sideBy, mimerId, type Phase, type State } from './state';
import '../impostor/impostor.css';
import './mimica.css';

const SCREENS = {
  mode: ModeScreen, sides: SidesScreen, cats: CatsScreen, cfg: CfgScreen, pass: PassScreen, choose: ChooseScreen, play: PlayScreen,
  judge: JudgeScreen, steal: StealScreen, pick: PickScreen, assign: AssignScreen, result: ResultScreen, final: FinalScreen,
} as const;

/** Fases com um turno em andamento: sair sem querer perderia o que foi feito. */
const IN_GAME: Phase[] = ['pass', 'choose', 'play', 'judge', 'steal', 'pick', 'assign', 'result'];

/** Cartelas de transição: nova rodada, "tempo!" e resultado final. */
function splashFor(s: State): { key: string; title: string; sub: string } | null {
  const turn = s.schedule[s.turn];
  if (s.phase === 'pass' && turn && turn.index % (s.schedule.length / s.settings.rounds) === 0) {
    return { key: `round-${s.seed}-${turn.round}`, title: `Rodada ${turn.round}`, sub: turn.round === s.settings.rounds && turn.round > 1 ? 'A última rodada' : `${turn.round} de ${s.settings.rounds}` };
  }
  if (s.prev === 'play' && s.timedOut && (s.phase === 'judge' || s.phase === 'assign' || s.phase === 'pick' || (s.phase === 'result' && s.style === 'speed'))) {
    return { key: `time-${s.seed}-${s.turn}`, title: 'Acabou o tempo!', sub: s.style === 'classic' ? 'Vamos ver quem acertou' : 'Vamos contar os acertos' };
  }
  if (s.phase === 'final') return { key: `final-${s.seed}`, title: 'Fim de jogo', sub: 'O placar final' };
  return null;
}
const SPLASH_MS = 1300;

class Guard extends Component<{ onReset: () => void; children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error('mimica', e, i.componentStack); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="im-screen im-centered" role="alert" data-testid="mm-crash">
        <div className="im-body im-mid">
          <h2 className="im-t">Algo deu errado</h2>
          <p className="im-sub">A partida travou. Seus times e jogadores continuam salvos. Toque para recomeçar.</p>
        </div>
        <div className="im-foot"><Primary sound={null} onClick={() => { this.props.onReset(); this.setState({ err: false }); }}>Recomeçar</Primary></div>
      </div>
    );
  }
}

/** Mímica, modo Mesa (spec 089): o celular passa de mão em mão, tudo no aparelho, sem internet. */
export function MimicaGame() {
  const navigate = useNavigate();
  const [s, d] = useReducer(reducer, undefined, initial);
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
  useEffect(() => saveSetup(s), [s.format, s.style, s.settings.seconds, s.settings.rounds]); // eslint-disable-line react-hooks/exhaustive-deps

  // fechar a aba, atualizar ou voltar pelo navegador no meio do turno: pergunta antes
  useEffect(() => {
    const bye = (e: BeforeUnloadEvent) => {
      if (!live.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    const pop = () => {
      if (!live.current) return;
      history.pushState(null, '');
      setAsk({ title: 'Sair da partida?', text: 'O turno em andamento se perde. O placar fica como está.', confirm: 'Sair da partida', cancel: 'Continuar jogando', danger: true, onConfirm: () => d({ type: 'leave' }) });
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
  const noSplash = (() => { try { return localStorage.getItem('mm-nosplash') === '1' || fast(); } catch { return false; } })();
  const showSplash = !!sp && sp.key !== doneKey && !noSplash;
  useEffect(() => {
    if (!sp || sp.key === doneKey) return undefined;
    const ms = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 700 : SPLASH_MS;
    const t = window.setTimeout(() => setDoneKey(sp.key), ms);
    return () => window.clearTimeout(t);
  }, [sp?.key, doneKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const exit = () => void navigate({ to: '/mesa' });
  const who = s.schedule[s.turn] && s.phase !== 'mode' && s.phase !== 'final' ? mimerId(s) : null;
  return (
    <div className="im-app mm-app" data-testid="mm-app" data-phase={s.phase} data-who={who ? sideBy(s, who).name : ''}>
      <div className="im-lamp mm-lamp" aria-hidden="true" />
      <AskCtx.Provider value={askRef}>
        <Guard onReset={() => d({ type: 'reset' })}>
          {showSplash && sp ? (
            <div className="im-splash mm-splash" data-testid="mm-splash" onClick={() => setDoneKey(sp.key)} key={sp.key}>
              <span className="im-splash-bar" aria-hidden="true" />
              <span className="im-splash-t" role="status">{sp.title}</span>
              <span className="im-splash-s">{sp.sub}</span>
            </div>
          ) : (
            <div key={`${s.phase}-${s.turn}-${s.seed}`} className={`im-view${s.back ? ' back' : ''}`}>
              <Screen s={s} d={d} exit={exit} />
            </div>
          )}
        </Guard>
        {ask && <Confirm cfg={ask} onClose={() => setAsk(null)} />}
      </AskCtx.Provider>
    </div>
  );
}
