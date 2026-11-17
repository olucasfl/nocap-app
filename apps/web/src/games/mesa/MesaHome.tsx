import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { NicknameDialog } from '@/components/NicknameDialog';
import { RoomConflictDialog } from '@/components/RoomConflictDialog';
import { TableArt } from '@/components/HubArt';
import { useRoomEntry } from '@/lib/my-room';
import { preloadImages } from './impostor/assets';
import { play, preloadSounds } from './impostor/audio';
import { Alert, ArrowIcon, Icon, Primary, TopBar, Words, useFlash } from './impostor/ui';
import './impostor/impostor.css';

type Step = 'home' | 'mode' | 'online';

const STEPS: { icon: string; title: string; text: string }[] = [
  { icon: 'olhos', title: 'Veja o seu papel', text: 'Todo mundo recebe a mesma palavra secreta, menos o impostor.' },
  { icon: 'ampulheta', title: 'Deem dicas e debatam', text: 'Uma palavra por pessoa, rodada a rodada. Depois, conversem.' },
  { icon: 'lupa', title: 'Votem em segredo', text: 'Quem acerta o impostor ganha pontos. O ranking soma as partidas.' },
];
const FACTS = ['3 a 15 pessoas', '4 modos de jogo', '10 temas', 'Sem anúncio'];

/**
 * A casa do Dinner Table Games (spec 088). Três telas: a apresentação do Impostor, a escolha de como jogar (online ou
 * na mesa, cada uma com a sua identidade) e a entrada online (criar sala ou colocar o código). Quem sai de uma sala ou de
 * uma partida volta para cá; só deixa o jogo quem toca em "Sair".
 */
export function MesaHome() {
  const navigate = useNavigate();
  const entry = useRoomEntry({ resume: true });
  const [step, setStep] = useState<Step>('home');
  const [back, setBack] = useState(false);
  const [code, setCode] = useState('');
  const [flash, show, clear] = useFlash();
  useEffect(() => {
    preloadImages();
    const first = () => preloadSounds();
    window.addEventListener('pointerdown', first, { once: true });
    return () => window.removeEventListener('pointerdown', first);
  }, []);
  const go = (s: Step, b = false) => {
    setBack(b);
    clear();
    setStep(s);
  };
  const leave = () => {
    play('back');
    void navigate({ to: '/' });
  };
  const create = () => {
    try {
      sessionStorage.setItem('cfx-new-room', 'impostor');
    } catch {
      /* o líder escolhe o jogo na sala */
    }
    void entry.create('foxcap');
  };
  const join = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length < 4) return show('O código da sala tem 4 letras. Peça para o líder da sala.');
    clear();
    void entry.join(c);
  };
  const err = flash?.m ?? entry.error;

  return (
    <div className="im-app" data-testid="mesa-home" data-step={step}>
      <div className="im-lamp" aria-hidden="true" />
      <div key={step} className={`im-view${back ? ' back' : ''}`}>
        {step === 'home' && (
          <div className="im-screen" data-testid="mesa-step-home">
            <TopBar onBack={leave} center={<span className="im-status">Dinner Table Games</span>} />
            <div className="im-body im-cover">
              <div className="im-cover-art im-rise" style={{ '--d': 1 } as CSSProperties}><TableArt /></div>
              <div className="im-cover-text">
                <h1 className="im-t im-cover-t"><Words text="Impostor" /></h1>
                <p className="im-sub im-rise" style={{ '--d': 3 } as CSSProperties}>O jogo de dedução para jogar em roda: ache quem está fingindo saber a palavra.</p>
                <ul className="im-facts im-rise" style={{ '--d': 4 } as CSSProperties}>{FACTS.map((f) => <li key={f}>{f}</li>)}</ul>
              </div>
              <ol className="im-how">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="im-rise" style={{ '--d': i + 5 } as CSSProperties}>
                    <Icon name={s.icon} size={44} className="im-how-ic" />
                    <span><b>{s.title}</b><small>{s.text}</small></span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="im-foot">
              <Primary testId="mesa-jogar" onClick={() => go('mode')}>Jogar Impostor <ArrowIcon /></Primary>
              <button type="button" className="im-link" data-testid="mesa-sair" onClick={leave}>Sair do Dinner Table Games</button>
            </div>
          </div>
        )}

        {step === 'mode' && (
          <div className="im-screen" data-testid="mesa-step-mode">
            <TopBar onBack={() => go('home', true)} center={<span className="im-status">Impostor</span>} />
            <div className="im-body im-mid">
              <h2 className="im-t"><Words text="Como vocês vão jogar?" /></h2>
              <div className="im-ways">
                <button type="button" className="im-way online im-rise" style={{ '--d': 1 } as CSSProperties} data-testid="mesa-online" onClick={() => { play('start'); go('online'); }}>
                  <Icon name="lugares" size={96} className="im-way-ic" />
                  <span className="im-way-t"><i>Online</i><b>Cada um no seu celular</b><small>Em qualquer lugar. Crie uma sala ou entre com o código. Dicas digitadas, chat e ranking da sala.</small></span>
                  <span className="im-way-go"><ArrowIcon /></span>
                </button>
                <button type="button" className="im-way mesa im-rise" style={{ '--d': 2 } as CSSProperties} data-testid="mesa-impostor" onClick={() => { play('start'); void navigate({ to: '/mesa/impostor' }); }}>
                  <Icon name="cartas" size={96} className="im-way-ic" />
                  <span className="im-way-t"><i>Na mesa</i><b>Um celular só</b><small>Todo mundo junto, passando o aparelho de mão em mão. Funciona sem internet.</small></span>
                  <span className="im-way-go"><ArrowIcon /></span>
                </button>
              </div>
            </div>
            <div className="im-foot" />
          </div>
        )}

        {step === 'online' && (
          <div className="im-screen" data-testid="mesa-step-online">
            <TopBar onBack={() => go('mode', true)} center={<span className="im-status">Impostor online</span>} />
            <div className="im-body">
              <h2 className="im-t"><Words text="Jogar online" /></h2>
              <section className="im-panel create im-rise" style={{ '--d': 1 } as CSSProperties}>
                <Icon name="coroa" size={56} className="im-panel-ic" />
                <div><b>Criar uma sala</b><small>Você é o líder: escolhe os temas e as regras e passa o código para a galera.</small></div>
                <Primary testId="mesa-create" disabled={entry.busy} onClick={create}>{entry.busy ? 'Criando a sala...' : 'Criar sala'}</Primary>
              </section>
              <div className="im-or" aria-hidden="true"><i /><span>ou</span><i /></div>
              <form className="im-panel join im-rise" style={{ '--d': 2 } as CSSProperties} onSubmit={join}>
                <Icon name="cartas" size={56} className="im-panel-ic" />
                <div><b>Entrar com um código</b><small>Peça ao líder o código de 4 letras da sala.</small></div>
                <div className="im-add">
                  <input id="mesa-code" data-testid="mesa-code" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)); clear(); }} placeholder="CÓDIGO" maxLength={4} autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-label="Código da sala" aria-invalid={!!err} className="im-codein" />
                  <button className="im-iconbtn pri" aria-label="Entrar com o código" data-testid="mesa-join" disabled={entry.busy}><ArrowIcon /></button>
                </div>
              </form>
            </div>
            {err && <div className="im-foot-alert"><Alert n={flash?.n ?? 0}>{err}</Alert></div>}
            <div className="im-foot" />
          </div>
        )}
      </div>
      <NicknameDialog nick={entry.nick} />
      <RoomConflictDialog open={!!entry.conflict} code={entry.conflict?.code ?? null} onBack={entry.backToCurrent} onLeave={() => void entry.leaveAndContinue()} onCancel={entry.dismissConflict} />
    </div>
  );
}
