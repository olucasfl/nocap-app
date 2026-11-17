import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { NicknameDialog } from '@/components/NicknameDialog';
import { RoomConflictDialog } from '@/components/RoomConflictDialog';
import { TableArt } from '@/components/HubArt';
import { useRoomEntry } from '@/lib/my-room';
import { preloadImages } from './impostor/assets';
import { play, preloadSounds } from './impostor/audio';
import { Alert, ArrowIcon, Icon, Primary, TopBar, Words, useFlash } from './impostor/ui';
import { MESA_GAMES, type MesaGameInfo } from './games';
import './impostor/impostor.css';

type Step = 'home' | 'mode' | 'online';

/** Um cartão do carrossel: capa, nome, descrição e, no que já existe, como se joga. O que ainda não existe leva o selo "Em breve". */
function GameSlide({ g, index, total }: { g: MesaGameInfo; index: number; total: number }) {
  return (
    <section className={`im-car-slide${g.soon ? ' soon' : ''}`} aria-label={`${g.name}, ${index + 1} de ${total}`} data-testid={`mesa-slide-${g.id}`}>
      <div className="im-cover">
        <div className="im-cover-art">
          {g.soon ? (
            <div className="im-soon-art" aria-hidden="true">
              <Icon name={g.icon ?? 'jogo'} size={150} className="im-soon-ic" />
              <span className="im-stamp">Em breve</span>
            </div>
          ) : <TableArt />}
        </div>
        <div className="im-cover-text">
          <h1 className="im-t im-cover-t">{g.name}</h1>
          <p className="im-sub">{g.desc}</p>
          <ul className="im-facts">{g.facts.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
        {g.steps && (
          <ol className="im-how">
            {g.steps.map((st) => (
              <li key={st.title}>
                <Icon name={st.icon} size={44} className="im-how-ic" />
                <span><b>{st.title}</b><small>{st.text}</small></span>
              </li>
            ))}
          </ol>
        )}
        {g.soon && <p className="im-sub im-soon-note">Estamos preparando este jogo. Em breve ele aparece aqui.</p>}
      </div>
    </section>
  );
}

/**
 * Roda de jogos: o jogo do meio em destaque, a "sombra" do anterior à esquerda e do próximo à direita, e uma seta em cada
 * lado da tela. Girar leva o próximo ao centro (e dá a volta: depois do último vem o primeiro). Só transform e opacity.
 */
function GamesCarousel({ active, onActive }: { active: number; onActive: (i: number) => void }) {
  const total = MESA_GAMES.length;
  const touch = useRef<number | null>(null);
  const goTo = useCallback((i: number) => {
    onActive(((i % total) + total) % total);
    play('tap');
  }, [onActive, total]);
  // a roda gira sozinha a cada 5 s (para quando a pessoa toca ou passa o mouse; nos testes automáticos e com "reduzir movimento" fica parada)
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold) return undefined;
    let off = false;
    try { off = localStorage.getItem('im-nosplash') === '1'; } catch { /* sem armazenamento */ }
    if (off || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = window.setTimeout(() => onActive((active + 1) % total), 5000);
    return () => window.clearTimeout(t);
  }, [active, hold, onActive, total]);
  /** Posição na roda em relação ao jogo do centro: -1 esquerda, 0 centro, 1 direita (os demais ficam atrás, escondidos). */
  const offset = (i: number) => {
    let o = (i - active + total) % total;
    if (o > total / 2) o -= total;
    return o;
  };
  return (
    <div
      className="im-wheel"
      role="region"
      aria-roledescription="carrossel"
      aria-label="Jogos de mesa"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); goTo(active + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(active - 1); } }}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
      onPointerDown={(e) => { touch.current = e.clientX; setHold(true); }}
      onPointerUp={(e) => {
        if (e.pointerType !== 'mouse') setHold(false);
        if (touch.current === null) return;
        const dx = e.clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) goTo(active + (dx < 0 ? 1 : -1));
      }}
      data-testid="mesa-carousel"
    >
      <button type="button" className="im-wheel-arrow left" aria-label="Jogo anterior" data-testid="mesa-prev" onClick={() => goTo(active - 1)}>
        <span className="im-arrow-flip"><ArrowIcon /></span>
      </button>
      <div className="im-wheel-stage">
        {MESA_GAMES.map((g, i) => {
          const o = offset(i);
          const shown = Math.abs(o) <= 1;
          return (
            <div
              key={g.id}
              className={`im-wheel-item${o === 0 ? ' on' : ''}`}
              style={{ '--o': Math.max(-2, Math.min(2, o)), '--a': Math.min(2, Math.abs(o)) } as CSSProperties}
              aria-hidden={o !== 0}
              data-pos={o === 0 ? 'center' : o < 0 ? 'left' : 'right'}
              onClick={() => { if (o !== 0 && shown) goTo(i); }}
            >
              <GameSlide g={g} index={i} total={total} />
            </div>
          );
        })}
      </div>
      <button type="button" className="im-wheel-arrow right" aria-label="Próximo jogo" data-testid="mesa-next" onClick={() => goTo(active + 1)}>
        <ArrowIcon />
      </button>
      <div className="im-dots" role="tablist" aria-label="Escolher jogo">
        {MESA_GAMES.map((g, i) => (
          <button key={g.id} type="button" role="tab" aria-selected={i === active} aria-label={g.name} className={`im-dot${i === active ? ' on' : ''}`} onClick={() => goTo(i)} />
        ))}
      </div>
    </div>
  );
}

/**
 * A casa do Dinner Table Games (spec 088). Três telas: a apresentação do Impostor, a escolha de como jogar (online ou
 * na mesa, cada uma com a sua identidade) e a entrada online (criar sala ou colocar o código). Quem sai de uma sala ou de
 * uma partida volta para cá; só deixa o jogo quem toca em "Sair".
 */
export function MesaHome() {
  const navigate = useNavigate();
  const entry = useRoomEntry({ resume: true });
  const [step, setStep] = useState<Step>('home');
  const [game, setGame] = useState(0);
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
    if (c.length < 4) return show('O código da sala tem 4 letras. Peça para quem criou a sala.');
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
            <div className="im-body im-gamesbody">
              <GamesCarousel active={game} onActive={setGame} />
            </div>
            <div className="im-foot">
              {MESA_GAMES[game]!.soon
                ? <Primary testId="mesa-soon" tone="ghost" disabled sound={null} onClick={() => undefined}>{MESA_GAMES[game]!.name}: em breve</Primary>
                : <Primary testId="mesa-jogar" onClick={() => go('mode')}>Jogar {MESA_GAMES[game]!.name} <ArrowIcon /></Primary>}
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
                <div><b>Criar uma sala</b><small>Você escolhe os temas e as regras e passa o código para a galera.</small></div>
                <Primary testId="mesa-create" disabled={entry.busy} onClick={create}>{entry.busy ? 'Criando a sala...' : 'Criar sala'}</Primary>
              </section>
              <div className="im-or" aria-hidden="true"><i /><span>ou</span><i /></div>
              <form className="im-panel join im-rise" style={{ '--d': 2 } as CSSProperties} onSubmit={join}>
                <Icon name="cartas" size={56} className="im-panel-ic" />
                <div><b>Entrar com um código</b><small>Peça para quem criou a sala o código de 4 letras.</small></div>
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
