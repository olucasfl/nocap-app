import { useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { currentRoomCode } from '@/lib/rooms';
import {
  GOLF_BALL_COLORS,
  GOLF_BALL_COLOR_NAMES,
  GOLF_FINISHES,
  GOLF_FINISH_LABEL,
  GOLF_TRAILS,
  GOLF_TRAIL_LABEL,
  type GolfBallLook,
} from '@nocap/games';
import { useTouchGuard } from '../foxgp/touch-guard';
import { BallPreview } from './BallPreview';
import { loadLook, saveLook } from './golf-save';
import './minigolf.css';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Personalizar a bola (spec 082): cor (12 ou livre), acabamento e rastro, com prévia 3D. Salva no aparelho e na conta. */
export function MiniGolfBall() {
  useTouchGuard();
  const navigate = useNavigate();
  const wanted = useSearch({ strict: false }) as { volta?: string };
  const [look, setLook] = useState<GolfBallLook>(loadLook());
  const set = (p: Partial<GolfBallLook>) => setLook((l) => ({ ...l, ...p }));
  const idx = GOLF_BALL_COLORS.indexOf(look.color as (typeof GOLF_BALL_COLORS)[number]);
  // vindo do lobby da sala, volta para a sala
  const back = () => {
    const code = wanted.volta === 'sala' ? currentRoomCode() : null;
    if (code) void navigate({ to: '/sala/$code', params: { code } });
    else void navigate({ to: '/minigolf' });
  };

  return (
    <div className="mgh" data-testid="mg-ball">
      <div className="mgh-wrap">
        <div className="mgh-top">
          <button type="button" className="mg-pill ghost" onClick={back}>Voltar</button>
          <div>
            <div className="mg-kick">Garagem</div>
            <h1 className="mg-disp mgh-h">Sua bola</h1>
          </div>
        </div>
        <div className="mgh-ballgrid">
          <div className="mgh-card mgh-previewcard">
            <BallPreview look={look} />
            <span className="mg-tag">{idx >= 0 ? GOLF_BALL_COLOR_NAMES[idx] : 'Cor livre'}</span>
          </div>
          <div className="mgh-opts">
            <section>
              <div className="mg-kick">Cor</div>
              <div className="mgh-sw">
                {GOLF_BALL_COLORS.map((c, i) => (
                  <button key={c} type="button" className={`mgh-swatch${look.color === c ? ' on' : ''}`} style={{ background: hex(c) }} aria-label={GOLF_BALL_COLOR_NAMES[i]} aria-pressed={look.color === c} onClick={() => set({ color: c })} />
                ))}
                <label className="mgh-swatch mgh-free" aria-label="Cor livre">
                  <input type="color" value={hex(look.color)} onChange={(e) => set({ color: parseInt(e.target.value.slice(1), 16) })} />
                </label>
              </div>
            </section>
            <section>
              <div className="mg-kick">Cor secundária <span className="mgh-mut">(listras, pontos, metade e estrela)</span></div>
              <div className="mgh-sw">
                <button type="button" className={`mgh-swatch mgh-auto${look.color2 === undefined ? ' on' : ''}`} aria-label="Automática" aria-pressed={look.color2 === undefined} onClick={() => set({ color2: undefined })} data-testid="mg-color2-auto">Auto</button>
                {GOLF_BALL_COLORS.map((c, i) => (
                  <button key={c} type="button" className={`mgh-swatch${look.color2 === c ? ' on' : ''}`} style={{ background: hex(c) }} aria-label={`Secundária ${GOLF_BALL_COLOR_NAMES[i]}`} aria-pressed={look.color2 === c} onClick={() => set({ color2: c })} />
                ))}
                <label className="mgh-swatch mgh-free" aria-label="Cor secundária livre">
                  <input type="color" value={hex(look.color2 ?? 0xffffff)} onChange={(e) => set({ color2: parseInt(e.target.value.slice(1), 16) })} />
                </label>
              </div>
            </section>
            <section>
              <div className="mg-kick">Acabamento</div>
              <div className="mgh-chips" role="radiogroup" aria-label="Acabamento">
                {GOLF_FINISHES.map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={look.finish === f} className={`mgh-chip${look.finish === f ? ' on' : ''}`} onClick={() => set({ finish: f })} data-testid={`mg-finish-${f}`}>{GOLF_FINISH_LABEL[f]}</button>
                ))}
              </div>
            </section>
            <section>
              <div className="mg-kick">Rastro ao rolar</div>
              <div className="mgh-chips" role="radiogroup" aria-label="Rastro">
                {GOLF_TRAILS.map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={look.trail === t} className={`mgh-chip${look.trail === t ? ' on' : ''}`} onClick={() => set({ trail: t })} data-testid={`mg-trail-${t}`}>{GOLF_TRAIL_LABEL[t]}</button>
                ))}
              </div>
            </section>
            <div className="mgh-save">
              <span className="mgh-mut">Fica salva na sua conta. Os amigos veem a bola assim na sala.</span>
              <button type="button" className="mg-pill pri" onClick={() => { saveLook(look); back(); }} data-testid="mg-save">Salvar bola</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
