import { useEffect, type CSSProperties } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { preloadImages } from './impostor/assets';
import { play, preloadSounds } from './impostor/audio';
import { Icon, TopBar, Words } from './impostor/ui';
import './impostor/impostor.css';

/** Entrada da categoria "Dinner Table Games" (spec 088): jogos de roda, com o celular passando de mão em mão. */
export function MesaHome() {
  const navigate = useNavigate();
  useEffect(() => {
    preloadImages();
    const first = () => preloadSounds();
    window.addEventListener('pointerdown', first, { once: true });
    return () => window.removeEventListener('pointerdown', first);
  }, []);
  return (
    <div className="im-app" data-testid="mesa-home">
      <div className="im-lamp" aria-hidden="true" />
      <div className="im-view">
        <div className="im-screen">
          <TopBar onBack={() => void navigate({ to: '/' })} />
          <div className="im-body">
            <div>
              <h2 className="im-t"><Words text="Jogos de mesa" /></h2>
              <p className="im-sub im-rise" style={{ '--d': 3 } as CSSProperties}>Para jogar em roda, com o celular na mão de todo mundo.</p>
            </div>
            <div className="im-games">
              <button type="button" className="im-game im-rise" style={{ '--d': 4 } as CSSProperties} data-testid="mesa-impostor" onClick={() => { play('start'); void navigate({ to: '/mesa/impostor' }); }}>
                <span><b>Impostor</b><small>3 a 15 pessoas</small></span>
                <Icon name="jogo" size={120} className="im-game-ic" />
              </button>
              <div className="im-game soon im-rise" style={{ '--d': 5 } as CSSProperties}><span><b>Cidade dorme</b></span><span className="im-soon">EM BREVE</span></div>
              <div className="im-game soon im-rise" style={{ '--d': 6 } as CSSProperties}><span><b>Mímica</b></span><span className="im-soon">EM BREVE</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
