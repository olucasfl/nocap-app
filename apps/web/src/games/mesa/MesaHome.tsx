import { useEffect, type CSSProperties } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { NicknameDialog } from '@/components/NicknameDialog';
import { RoomConflictDialog } from '@/components/RoomConflictDialog';
import { useRoomEntry } from '@/lib/my-room';
import { preloadImages } from './impostor/assets';
import { preloadSounds } from './impostor/audio';
import { Icon, Primary, TopBar, Words } from './impostor/ui';
import './impostor/impostor.css';

/** Entrada da categoria "Dinner Table Games" (spec 088): jogos de roda, com o celular passando de mão em mão. */
export function MesaHome() {
  const navigate = useNavigate();
  const entry = useRoomEntry({ resume: true });
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
              <div className="im-game im-rise" style={{ '--d': 4 } as CSSProperties} data-testid="mesa-impostor-card">
                <span><b>Impostor</b><small>3 a 15 pessoas</small></span>
                <Icon name="jogo" size={120} className="im-game-ic" />
              </div>
              <div className="im-modes2 im-rise" style={{ '--d': 5 } as CSSProperties}>
                <Primary testId="mesa-impostor" onClick={() => void navigate({ to: '/mesa/impostor' })}>Jogar à mesa <span className="im-sub-inline">1 celular</span></Primary>
                <Primary tone="ghost" testId="mesa-online" onClick={() => { try { sessionStorage.setItem('cfx-new-room', 'impostor'); } catch { /* o líder escolhe o jogo na sala */ } void entry.create('foxcap'); }} disabled={entry.busy}>
                  {entry.busy ? 'Criando a sala...' : 'Jogar online'} <span className="im-sub-inline">cada um no seu</span>
                </Primary>
                {entry.error && <p className="im-sub warn" role="alert">{entry.error}</p>}
              </div>
              <div className="im-game soon im-rise" style={{ '--d': 6 } as CSSProperties}><span><b>Cidade dorme</b></span><span className="im-soon">EM BREVE</span></div>
              <div className="im-game soon im-rise" style={{ '--d': 7 } as CSSProperties}><span><b>Mímica</b></span><span className="im-soon">EM BREVE</span></div>
            </div>
          </div>
        </div>
      </div>
      <NicknameDialog nick={entry.nick} />
      <RoomConflictDialog open={!!entry.conflict} code={entry.conflict?.code ?? null} onBack={entry.backToCurrent} onLeave={() => void entry.leaveAndContinue()} onCancel={entry.dismissConflict} />
    </div>
  );
}
