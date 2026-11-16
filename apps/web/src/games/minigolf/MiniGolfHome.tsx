import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { NicknameDialog } from '@/components/NicknameDialog';
import { RoomConflictDialog } from '@/components/RoomConflictDialog';
import { useRoomEntry } from '@/lib/my-room';
import { GOLF_LEVELS, GOLF_TIERS, GOLF_TIER_LABEL, type GolfTier } from '@nocap/games';
import { useTouchGuard } from '../foxgp/touch-guard';
import { BallPreview } from './BallPreview';
import { loadBest, loadLook } from './golf-save';
import './minigolf.css';

/** Tela inicial do Mini Golf (spec 082): jogar (25 fases) e jogar online (criar sala ou entrar por código), personalizar a bola. */
export function MiniGolfHome() {
  useTouchGuard();
  const navigate = useNavigate();
  const entry = useRoomEntry({ resume: true });
  const [online, setOnline] = useState(false);
  const [code, setCode] = useState('');
  const best = loadBest();
  const look = loadLook();
  const done = Object.keys(best).length;
  return (
    <div className="mgh" data-testid="mg-home">
      <div className="mgh-wrap">
        <div className="mgh-top">
          <button type="button" className="mg-pill ghost" onClick={() => void navigate({ to: '/' })}>Jogos</button>
          <span className="mg-kick">NoCap / Mini Golf</span>
        </div>
        <div className="mgh-grid">
          <div className="mgh-left">
            <h1 className="mg-disp mgh-title">Mini<br />Golf</h1>
            <p className="mgh-mut mgh-lead">25 fases para treinar sozinho, em três dificuldades. Menos tacadas ganha.</p>
            <div className="mgh-btns">
              <button type="button" className="mg-pill pri mgh-big" onClick={() => void navigate({ to: '/minigolf/fases' })} data-testid="mg-offline">Jogar</button>
              <button type="button" className="mg-pill pri mgh-big" onClick={() => setOnline((o) => !o)} aria-expanded={online} data-testid="mg-online">Jogar online</button>
              {online && (
                <div className="mgh-card mgh-online" data-testid="mg-online-panel">
                  {entry.error && <p className="mgh-err" role="alert">{entry.error}</p>}
                  <button
                    type="button"
                    className="mg-pill pri"
                    disabled={entry.busy}
                    onClick={() => {
                      // a sala nasce já com o Mini Golf escolhido (como no Fox GP)
                      try {
                        sessionStorage.setItem('cfx-new-room', 'golf');
                      } catch {
                        /* o líder escolhe o jogo na sala */
                      }
                      void entry.create('foxcap');
                    }}
                    data-testid="mg-create"
                  >
                    {entry.busy ? 'Criando...' : 'Criar sala com amigos'}
                  </button>
                  <form
                    className="mgh-join"
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      void entry.join(code);
                    }}
                  >
                    <input
                      className="mgh-code"
                      value={code}
                      maxLength={4}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      autoComplete="off"
                      placeholder="CÓDIGO"
                      aria-label="Código da sala"
                      onChange={(e) => {
                        setCode(e.target.value.toUpperCase());
                        entry.clearError();
                      }}
                      data-testid="mg-code"
                    />
                    <button type="submit" className="mg-pill" disabled={entry.busy || code.length !== 4}>Entrar</button>
                  </form>
                </div>
              )}
              <button type="button" className="mg-pill ghost mgh-mid" onClick={() => void navigate({ to: '/minigolf/bola' })} data-testid="mg-customize">Personalizar bola</button>
              <button type="button" className="mg-pill mgh-mid mgh-exit" onClick={() => void navigate({ to: '/' })} data-testid="mg-exit">Sair do jogo</button>
            </div>
          </div>
          <div className="mgh-right">
            <div className="mgh-card mgh-heroball"><BallPreview look={look} /></div>
            <div className="mgh-stats">
              <div className="mgh-card"><div className="mg-kick">Fases feitas</div><div className="mg-disp mgh-num">{done}<small>/{GOLF_LEVELS}</small></div></div>
              {(Object.keys(GOLF_TIERS) as GolfTier[]).map((t) => (
                <div key={t} className="mgh-card"><div className="mg-kick">{GOLF_TIER_LABEL[t]}</div><div className="mg-disp mgh-num">{GOLF_TIERS[t].filter((n) => best[n]).length}<small>/{GOLF_TIERS[t].length}</small></div></div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <NicknameDialog nick={entry.nick} />
      <RoomConflictDialog
        open={!!entry.conflict}
        code={entry.conflict?.code ?? null}
        onBack={entry.backToCurrent}
        onLeave={() => void entry.leaveAndContinue()}
        onCancel={entry.dismissConflict}
      />
    </div>
  );
}
