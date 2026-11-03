import { useEffect, useRef } from 'react';
import { FS_ARENA, FS_TARGETS, type FsWeaponId } from '@nocap/games';
import { HeartIcon, SkullIcon, VestIcon, WeaponIcon } from './fs-icons';
import { bindLabel, CROSS_COLORS, useFsSettings } from './fs-settings';

export interface FsPlayerRow {
  id: string;
  name: string;
  you: boolean;
  alive: boolean;
  armor: number;
  kills: number;
  deaths: number;
  assists: number;
  hs: number;
  damage: number;
}

export interface FeedItem {
  key: number;
  killer: string;
  weapon: FsWeaponId;
  victim: string;
  head: boolean;
  /** Fui eu que matei? */
  you: boolean;
  /** Quem deu a assistência (se houve) e se fui eu. */
  assist?: string;
  youAssist?: boolean;
}

export interface MinimapData {
  x: number;
  z: number;
  yaw: number;
  targets: { x: number; z: number; alive: boolean; armor: number }[];
}

export const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Faixa de cima, como a do CS: abates à esquerda, os jogadores (vivos ou caídos) no meio, mortes à direita e o tempo embaixo. */
export function FsTopBar({
  players,
  timeLeft,
  kills,
  deaths,
}: {
  players: FsPlayerRow[];
  timeLeft: number;
  kills: number;
  deaths: number;
}) {
  const slots = Array.from({ length: 10 }, (_, i) => players[i] ?? null);
  return (
    <div className="fsh-top" data-testid="fs-topbar">
      <div className="fsh-top-row">
        <div className="fsh-score">
          <small>ABATES</small>
          <b>{kills}</b>
        </div>
        <ul className="fsh-players" aria-label="Jogadores">
          {slots.map((p, i) => (
            <li
              key={i}
              className={`${p ? (p.alive ? 'on' : 'dead') : 'empty'}${p?.you ? ' you' : ''}${p && p.armor > 0 ? ' vest' : ''}`}
            >
              {p ? <span>{p.you ? 'EU' : p.name.replace(/\D/g, '')}</span> : <span>?</span>}
              {p && !p.alive && <SkullIcon className="fsh-skull" />}
            </li>
          ))}
        </ul>
        <div className="fsh-score">
          <small>MORTES</small>
          <b>{deaths}</b>
        </div>
      </div>
      <div className="fsh-time" data-testid="fs-time">
        {clock(Math.max(0, timeLeft))}
      </div>
    </div>
  );
}

export function FsKillFeed({ items }: { items: FeedItem[] }) {
  return (
    <ul className="fsh-feed" aria-live="polite" data-testid="fs-feed">
      {items.map((f) => (
        <li key={f.key} className={f.you || f.youAssist ? 'mine' : 'other'} data-testid={f.you || f.youAssist ? 'fs-feed-mine' : 'fs-feed-other'}>
          <b>{f.killer}</b>
          {f.assist && <span className="fsh-assist"> + {f.assist}</span>}
          <WeaponIcon id={f.weapon} className="fsh-feed-w" />
          {f.head && (
            <span className="fsh-hs" title="Cabeça">
              CABEÇA
            </span>
          )}
          <b>{f.victim}</b>
        </li>
      ))}
    </ul>
  );
}

/** Radar redondo: gira com o jogador (a frente é sempre para cima); mostra caixas, alvos e quem tem colete. */
export function FsMinimap({ get }: { get: () => MinimapData }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current!;
    const g = c.getContext('2d')!;
    const S = c.width;
    const R = 26; // metros visíveis do centro à borda
    const k = S / 2 / R;
    const draw = () => {
      const d = get();
      g.clearRect(0, 0, S, S);
      g.save();
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = 'rgba(20,24,40,.82)';
      g.fillRect(0, 0, S, S);
      g.translate(S / 2, S / 2);
      const yaw = (d.yaw * Math.PI) / 180;
      // mundo -> radar: yaw positivo gira para a esquerda; a frente fica para cima
      g.rotate(yaw);
      g.translate(-d.x * k, -d.z * k);
      g.fillStyle = 'rgba(190,200,215,.55)';
      for (const b of FS_ARENA) {
        g.fillRect(
          b.min[0] * k,
          b.min[2] * k,
          (b.max[0] - b.min[0]) * k,
          (b.max[2] - b.min[2]) * k,
        );
      }
      for (const t of d.targets) {
        if (!t.alive) continue;
        g.beginPath();
        g.arc(t.x * k, t.z * k, 3.4, 0, Math.PI * 2);
        g.fillStyle = '#ff7d26';
        g.fill();
        if (t.armor > 0) {
          g.lineWidth = 1.6;
          g.strokeStyle = '#7fa6ff';
          g.stroke();
        }
      }
      g.restore();
      // você: seta no centro apontando para cima
      g.fillStyle = '#7dff9a';
      g.strokeStyle = '#0b1b10';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(S / 2, S / 2 - 7);
      g.lineTo(S / 2 + 5, S / 2 + 6);
      g.lineTo(S / 2 - 5, S / 2 + 6);
      g.closePath();
      g.fill();
      g.stroke();
    };
    draw();
    const id = window.setInterval(draw, 66);
    return () => window.clearInterval(id);
  }, [get]);
  return (
    <canvas
      ref={cv}
      className="fsh-radar"
      width={150}
      height={150}
      data-testid="fs-radar"
      aria-label="Mapa"
    />
  );
}

/** Vida e colete, limpos, no canto de baixo à esquerda. */
export function FsVitals({ hp, armor, helmet }: { hp: number; armor: number; helmet: boolean }) {
  return (
    <div className={`fsh-vitals${hp <= 25 ? ' low' : ''}`} data-testid="fs-bars">
      <div>
        <HeartIcon className="fsh-ic" />
        <b>{hp}</b>
      </div>
      <div className="ar">
        <VestIcon className="fsh-ic" />
        <b>{armor}</b>
        {helmet && (
          <span className="fsh-helm" data-testid="fs-helmet">
            capacete
          </span>
        )}
      </div>
    </div>
  );
}

export interface FsSlotInfo {
  id: FsWeaponId | null;
  name: string;
  /** Tecla do espaço (1, 2, 3). */
  key: number;
}

/**
 * Armas embaixo à direita, no desenho do CS: uma linha por espaço (1 primária, 2 secundária, 3 faca) com o ícone da arma;
 * a que está na mão fica maior, com o nome e a munição em destaque.
 */
export function FsAmmo({
  weapon,
  id,
  ammo,
  mag,
  reloading,
  slots,
  current,
}: {
  weapon: string;
  id: FsWeaponId;
  ammo: number;
  mag: number;
  reloading: boolean;
  slots: FsSlotInfo[];
  current: number;
}) {
  const binds = useFsSettings((st) => st.binds);
  return (
    <div className={`fsh-ammo${ammo === 0 && mag > 0 && !reloading ? ' empty' : ''}`} data-testid="fs-ammo">
      <div className="fsh-ammo-n">
        <b>{mag > 0 ? (reloading ? '...' : ammo) : ''}</b>
        {mag > 0 && <span>/ {mag}</span>}
      </div>
      <ul className="fsh-slots" aria-label="Armas">
        {slots.map((s, i) =>
          s.id ? (
            <li key={s.key} className={i === current ? 'on' : ''} data-testid={`fs-slot-${s.key}`}>
              <i>{bindLabel(binds[`slot${s.key}` as 'slot1'])}</i>
              <WeaponIcon id={s.id} className="fsh-w" />
              {i === current && <small>{s.name}</small>}
            </li>
          ) : null,
        )}
      </ul>
      <span className="fsh-sr">
        {weapon} {id}
      </span>
    </div>
  );
}

export function FsTelemetry({
  fps,
  tris,
  calls,
  level,
  dpr,
  speed,
  ref,
}: {
  fps: number;
  tris: number;
  calls: number;
  level: string;
  dpr: number;
  speed: number;
  ref: string;
}) {
  return (
    <div className="fsh-tele mono" data-testid="fs-perf" aria-label="Desempenho">
      <b className={fps < 30 ? 'bad' : fps < 50 ? 'mid' : ''}>{fps} FPS</b>
      <span data-testid="fs-speed">velocidade {speed.toFixed(1)} m/s</span>
      <span>
        {Math.round(tris / 1000)} mil triângulos · {calls} desenhos
      </span>
      <span>
        qualidade {level === 'high' ? 'alta' : level === 'mid' ? 'média' : 'baixa'} · resolução{' '}
        {dpr}x
      </span>
      {ref && <span>modelos de referência: {ref}</span>}
    </div>
  );
}

/** Mira configurável: cor, tamanho, espessura, vão, ponto e abertura com a dispersão. */
export function FsCrosshair({ spreadPx }: { spreadPx: number }) {
  const s = useFsSettings();
  const gap = s.crossGap + (s.crossDynamic ? spreadPx : 0);
  return (
    <div
      className="fs-cross2"
      aria-hidden="true"
      style={{
        ['--g' as string]: `${gap}px`,
        ['--l' as string]: `${s.crossSize}px`,
        ['--t' as string]: `${s.crossThick}px`,
        ['--c' as string]: CROSS_COLORS[s.crossColor],
      }}
    >
      <i />
      <i />
      <i />
      <i />
      {s.crossDot && <b />}
    </div>
  );
}

/** Placar (Tab): todos os jogadores com abates, mortes, % de cabeça e dano, como o do CS. */
export function FsScoreboard({ players, timeLeft }: { players: FsPlayerRow[]; timeLeft: number }) {
  const binds = useFsSettings((st) => st.binds);
  const rows = [...players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  return (
    <div className="fsh-board" role="dialog" aria-label="Placar" data-testid="fs-board">
      <div className="fsh-board-card">
        <header>
          <span className="mono">Mata-mata · Arena de teste</span>
          <b>{clock(Math.max(0, timeLeft))}</b>
        </header>
        <table>
          <thead>
            <tr>
              <th />
              <th>Jogador</th>
              <th>Abates</th>
              <th>Assist.</th>
              <th>Mortes</th>
              <th>% cabeça</th>
              <th>Dano</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={`${p.you ? 'you' : ''}${p.alive ? '' : ' dead'}`}>
                <td>
                  <i className={`fsh-av${p.armor > 0 ? ' vest' : ''}`} />
                </td>
                <td>
                  {p.name}
                  {p.you ? ' (você)' : ''}
                </td>
                <td>{p.kills}</td>
                <td>{p.assists}</td>
                <td>{p.deaths}</td>
                <td>{p.kills > 0 ? Math.round((p.hs / p.kills) * 100) : 0}</td>
                <td>{p.damage}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 10 - rows.length) }, (_, i) => (
              <tr key={`e${i}`} className="empty">
                <td />
                <td>vaga livre</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer className="mono">Segure {bindLabel(binds.scoreboard)} para ver o placar</footer>
      </div>
    </div>
  );
}

export const targetsInfo = FS_TARGETS;
