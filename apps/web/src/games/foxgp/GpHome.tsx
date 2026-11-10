import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { gpTrack } from '@nocap/games';
import { GpCarPreview } from './GpCarPreview';
import { GpGarage } from './GpGarage';
import { loadGarage } from './garage';
import { GP_THEME } from './theme';
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
      if (e.code !== 'Escape' || garage) return;
      if (screen === 'main') onExit();
      else setScreen('main');
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [screen, garage, onExit]);
  const join = (e: FormEvent) => {
    e.preventDefault();
    room.join(code);
  };
  return createPortal(
    <div className="gph" data-testid="gp-home">
      <div className="gph-stripes" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="gph-flag gp-checker" aria-hidden="true" />
      <GpCarPreview fur={car.fur} paint={car.paint} className="gph-car" label="O seu carro, com a raposa no cockpit" interactive={false} />
      <div className="gph-main">
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
          <>
            <p className="gph-lead">
              A raposa do Atravessa trocou a travessia pela pista. Corrida voxel de F1, sozinho ou com a sala toda.
            </p>
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
                <button type="button" className="gp-tbtn is-ghost" onClick={onHelp} data-testid="gl-help">
                  Como jogar
                </button>
                <button type="button" className="gp-tbtn is-ghost" onClick={onExit} data-testid="gl-exit">
                  Voltar
                </button>
              </div>
            </div>
          </>
        )}
        {screen === 'friends' && (
          <div className="gph-panel gp-tpanel" data-testid="gl-friends-panel">
            <h2>Corrida online</h2>
            <p>Crie a sala e mande o código, ou entre com o código de alguém. De 2 a 8 raposas.</p>
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
