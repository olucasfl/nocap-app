import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { gpTrack } from '@nocap/games';
import { GpCarPreview } from './GpCarPreview';
import { GpCommands } from './GpCommands';
import { GpGarage } from './GpGarage';
import { loadGarage } from './garage';
import { gpTakeBack, loadBest } from './gp-best';
import { lapClock } from './format';
import { GP_THEME } from './theme';
import { GP_HOME_VEHICLES } from './vehicles';
import './theme.css';
import './gp-home.css';

export interface GpHomeRoom {
  busy: boolean;
  error: string | null;
  create: () => void;
  join: (code: string) => void;
  clearError: () => void;
}

/**
 * Tela inicial do Fox GP (spec 079, 3.2) no tema do artifact: faixas inclinadas azul, laranja e branca, o carro da sua
 * garagem em 3D, o título condensado e os botões Correr agora, Corrida online com a sala, Garagem e Pistas. A faixa
 * quadriculada embaixo. "Correr agora" abre a escolha do treino; "online" cria a sala ou entra por código ali mesmo.
 */
export function GpHome({
  onRace,
  onHelp,
  onExit,
  room,
  start = 'main',
}: {
  onRace: () => void;
  onHelp: () => void;
  onExit: () => void;
  room: GpHomeRoom;
  start?: 'main' | 'friends';
}) {
  const [screen, setScreen] = useState<'main' | 'friends' | 'track'>(start);
  const [garage, setGarage] = useState(false);
  const [car, setCar] = useState(() => loadGarage());
  const [code, setCode] = useState('');
  const [commands, setCommands] = useState(false);
  /** Voltando de uma partida: a tela já aparece pronta, sem a animação de entrada. */
  const [back] = useState(gpTakeBack);
  /** Carro mostrado no carrossel (só para ver: não muda o modo que se joga, que é o de "Antes de correr"). */
  const [shown, setShown] = useState(0);
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const many = GP_HOME_VEHICLES.length > 1;
  const turn = (by: number) =>
    setShown((i) => (i + by + GP_HOME_VEHICLES.length) % GP_HOME_VEHICLES.length);
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (garage || commands) return;
      if (screen === 'main' && many && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        setShown((i) => (i + (e.code === 'ArrowLeft' ? -1 : 1) + GP_HOME_VEHICLES.length) % GP_HOME_VEHICLES.length);
        return;
      }
      if (e.code !== 'Escape') return;
      if (screen === 'main') onExit();
      else setScreen('main');
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [screen, garage, commands, onExit, many]);
  const join = (e: FormEvent) => {
    e.preventDefault();
    room.join(code);
  };
  return createPortal(
    <div className={back ? 'gph is-back' : 'gph'} data-testid="gp-home" data-back={back ? '1' : undefined}>
      <div className="gph-stripes" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="gph-flag gp-checker" aria-hidden="true" />
      <GpCarPreview
        fur={car.fur}
        paint={car.paint}
        className="gph-car"
        label="O seu carro, com a raposa no cockpit. Arraste para girar."
      />
      {screen === 'main' && (
        <HomeCarousel shown={shown} onTurn={turn} />
      )}
      <div className="gph-main" data-screen={screen}>
        <div className="gph-head">
          <div className="gph-brand">
            <span className="gph-tag">Fox Cap</span>
            <span className="gp-kicker">Um jogo da nocap</span>
          </div>
          <h1 className="gp-title gph-title">
            Fox
            <br />
            <span>GP</span>
          </h1>
          {screen === 'main' && (
            <p className="gph-lead">
              A raposa do Atravessa trocou a travessia pela pista. Corrida com até 12 carros, sozinho ou com a sala
              toda.
            </p>
          )}
        </div>
        {screen === 'main' && (
          <>
            <div className="gph-btns">
              <button type="button" className="gp-tbtn is-primary gph-go" onClick={onRace} data-testid="gl-offline">
                Correr agora
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </button>
              <button type="button" className="gp-tbtn" onClick={() => setScreen('friends')} data-testid="gl-friends">
                Corrida online com a sala
              </button>
              <div className="gph-two">
                <button type="button" className="gp-tbtn" onClick={() => setGarage(true)} data-testid="gp-open-garage">
                  Garagem
                </button>
                <button type="button" className="gp-tbtn" onClick={() => setScreen('track')} data-testid="gp-open-track">
                  Pistas
                </button>
              </div>
              <div className="gph-two">
                <button type="button" className="gp-tbtn" onClick={() => setCommands(true)} data-testid="gp-open-commands">
                  Comandos
                </button>
                <button type="button" className="gp-tbtn" onClick={onHelp} data-testid="gl-help">
                  Como jogar
                </button>
              </div>
              <button type="button" className="gp-tbtn is-ghost gph-exit" onClick={onExit} data-testid="gl-exit">
                Voltar
              </button>
            </div>
          </>
        )}
        {screen === 'friends' && (
          <div className="gph-panel gp-tpanel" data-testid="gl-friends-panel">
            <h2>Corrida online</h2>
            <p>
              Crie a sala e mande o código, ou entre com o código de alguém. De 2 a 12 raposas; o líder escolhe a física
              no lobby.
            </p>
            {room.error && (
              <p className="gph-error" role="alert" data-testid="gl-error">
                {room.error}
              </p>
            )}
            <button type="button" className="gp-tbtn is-primary" disabled={room.busy} onClick={room.create} data-testid="foxcap-friends">
              {room.busy ? 'Criando...' : 'Criar sala'}
            </button>
            <form className="gph-join" onSubmit={join} noValidate>
              <label>
                <span className="gp-kicker">Código da sala</span>
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    room.clearError();
                  }}
                  maxLength={4}
                  autoCapitalize="characters"
                  autoComplete="off"
                  data-testid="gl-code"
                />
              </label>
              <button type="submit" className="gp-tbtn" disabled={room.busy} data-testid="gl-join">
                Entrar
              </button>
            </form>
            <button type="button" className="gp-tbtn is-ghost" onClick={() => setScreen('main')}>
              Voltar
            </button>
          </div>
        )}
        {screen === 'track' && (
          <div className="gph-panel gp-tpanel" data-testid="gp-track-panel">
            <h2>Circuito da Marina</h2>
            <TrackMap />
            <p>
              {(gpTrack().length / 1000).toFixed(2).replace('.', ',')} km · 3 voltas · reta norte, grampo, marina e o miolo
              de curvas. Boxes do lado de dentro da reta principal.
            </p>
            <button type="button" className="gp-tbtn is-ghost" onClick={() => setScreen('main')}>
              Voltar
            </button>
          </div>
        )}
      </div>
      {commands && <GpCommands touch={touch} onClose={() => setCommands(false)} />}
      {garage && (
        <GpGarage
          onClose={() => setGarage(false)}
          onSave={(g) => setCar(g)}
          primary="Salvar e voltar"
        />
      )}
    </div>,
    document.body,
  );
}

/**
 * Carrossel embaixo do carro (spec 081, 13.2): nome do modo e do veículo e a melhor volta offline daquele modo. Setas,
 * ← → e arrastar de lado trocam o carro; com um carro só (o kart ainda não existe) as setas somem. Só para ver os carros.
 */
function HomeCarousel({ shown, onTurn }: { shown: number; onTurn: (by: number) => void }) {
  const v = GP_HOME_VEHICLES[shown] ?? GP_HOME_VEHICLES[0]!;
  const best = loadBest(v.mode);
  const many = GP_HOME_VEHICLES.length > 1;
  const [x0, setX0] = useState<number | null>(null);
  return (
    <div
      className="gph-carousel"
      data-testid="gp-home-carousel"
      data-vehicle={v.vehicle}
      onPointerDown={(e) => setX0(e.clientX)}
      onPointerUp={(e) => {
        if (x0 !== null && many && Math.abs(e.clientX - x0) > 40) onTurn(e.clientX < x0 ? 1 : -1);
        setX0(null);
      }}
    >
      {many && (
        <button type="button" className="gph-carousel-btn" aria-label="Carro anterior" onClick={() => onTurn(-1)}>
          ‹
        </button>
      )}
      <div className="gph-carousel-info" key={v.vehicle} data-testid="gp-best">
        <span className="gph-carousel-title">
          {v.modeName} · {v.vehicleName}
        </span>
        <span className="gph-carousel-best">
          Melhor volta: <b className="gpn">{best !== null ? lapClock(best) : 'ainda sem tempo'}</b>
        </span>
      </div>
      {many && (
        <button type="button" className="gph-carousel-btn" aria-label="Próximo carro" onClick={() => onTurn(1)}>
          ›
        </button>
      )}
    </div>
  );
}

/** O desenho do circuito (o mesmo traçado da pista do jogo). */
function TrackMap() {
  const t = gpTrack();
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < t.n; i += 4) {
    minX = Math.min(minX, t.x[i]!);
    maxX = Math.max(maxX, t.x[i]!);
    minZ = Math.min(minZ, t.z[i]!);
    maxZ = Math.max(maxZ, t.z[i]!);
  }
  const w = 360;
  const k = (w - 30) / (maxX - minX);
  const h = (maxZ - minZ) * k + 30;
  let d = '';
  for (let i = 0; i <= t.n; i += 3) {
    const j = i % t.n;
    d += `${i === 0 ? 'M' : 'L'}${(15 + (t.x[j]! - minX) * k).toFixed(1)} ${(15 + (t.z[j]! - minZ) * k).toFixed(1)}`;
  }
  const sx = 15 + (t.x[0]! - minX) * k;
  const sz = 15 + (t.z[0]! - minZ) * k;
  return (
    <svg className="gph-map" viewBox={`0 0 ${w} ${h.toFixed(0)}`} role="img" aria-label="Traçado do Circuito da Marina">
      <path d={`${d}Z`} fill="none" stroke={GP_THEME.line2} strokeWidth="12" strokeLinejoin="round" />
      <path d={`${d}Z`} fill="none" stroke={GP_THEME.text2} strokeWidth="4" strokeLinejoin="round" />
      <rect x={sx - 6} y={sz - 6} width="12" height="12" fill={GP_THEME.accent} />
    </svg>
  );
}
