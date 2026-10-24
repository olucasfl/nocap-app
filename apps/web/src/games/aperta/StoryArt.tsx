import { GRIMOIRES } from '@nocap/games';
import type { ReactNode } from 'react';
import { GrimoireBook } from './GrimoireBook';
import { SpaceArtSprite } from './SpaceArtSprite';
import { artRarity, astroFor } from './game-logic';

/**
 * As 4 cenas da abertura (spec 042, adendo "História premium"): SVG próprio, 640x320, só `transform`/`opacity` animam
 * (classes `st-*` em `story.css`). Cada cena monta do zero a cada tela, então as animações de entrada rodam de novo.
 */
const INK = '#02030a';

/** Estrelas determinísticas (a mesma cena sempre desenha o mesmo céu). */
function stars(seed: number, n: number): [number, number, number][] {
  let s = seed;
  const next = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  return Array.from({ length: n }, () => [Math.round(next() * 640), Math.round(next() * 320), 0.6 + next() * 1.4]);
}

function Stars({ seed, n, className }: { seed: number; n: number; className: string }) {
  return (
    <g className={className} fill="#fff">
      {stars(seed, n).map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} opacity={0.35 + (i % 4) * 0.15} />
      ))}
    </g>
  );
}

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg className="ap-scene st-cam" viewBox="0 0 640 320" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

/** 1. A estação à deriva: as janelas se apagam uma a uma. */
function SceneStation() {
  const windows = [0, 1, 2, 3, 4, 5];
  return (
    <Frame label="A estação Perigeu à deriva diante de um planeta, com as luzes se apagando">
      <defs>
        <radialGradient id="st-glow" cx="78%" cy="70%" r="70%">
          <stop offset="0" stopColor="#1d2f8a" stopOpacity=".55" />
          <stop offset="1" stopColor="#02030a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="st-planet" cx="32%" cy="28%" r="85%">
          <stop offset="0" stopColor="#5b7cff" />
          <stop offset=".55" stopColor="#25379a" />
          <stop offset="1" stopColor="#070b2c" />
        </radialGradient>
        <linearGradient id="st-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dbe2f2" />
          <stop offset="1" stopColor="#8d98b8" />
        </linearGradient>
        <linearGradient id="st-panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4aa8ff" />
          <stop offset="1" stopColor="#1a3f9c" />
        </linearGradient>
      </defs>
      <rect width="640" height="320" fill="url(#st-glow)" />
      <Stars seed={7} n={46} className="st-drift-a" />
      <Stars seed={19} n={26} className="st-drift-b" />
      <g className="st-planet">
        <circle cx="520" cy="236" r="132" fill="url(#st-planet)" />
        <circle cx="520" cy="236" r="132" fill="none" stroke="#7fb2ff" strokeWidth="2" opacity=".45" />
        <path d="M410 214c40 26 120 30 220 4" fill="none" stroke="#9db6ff" strokeWidth="2" opacity=".25" />
        <path d="M402 250c50 24 140 26 230-6" fill="none" stroke="#9db6ff" strokeWidth="2" opacity=".18" />
      </g>
      <g className="st-station">
        <path d="M120 164h330" stroke="#5a648a" strokeWidth="5" />
        <rect x="140" y="112" width="74" height="104" rx="4" fill="url(#st-panel)" stroke={INK} strokeWidth="3" />
        <path d="M140 138h74M140 164h74M140 190h74M177 112v104" stroke={INK} strokeWidth="1.5" opacity=".5" />
        <rect x="356" y="112" width="74" height="104" rx="4" fill="url(#st-panel)" stroke={INK} strokeWidth="3" />
        <path d="M356 138h74M356 164h74M356 190h74M393 112v104" stroke={INK} strokeWidth="1.5" opacity=".5" />
        <rect x="236" y="130" width="130" height="68" rx="14" fill="url(#st-hull)" stroke={INK} strokeWidth="4" />
        <rect x="262" y="104" width="78" height="30" rx="8" fill="#c7cede" stroke={INK} strokeWidth="4" />
        {windows.map((i) => (
          <rect key={i} className="st-win" style={{ ['--i' as string]: i }} x={246 + i * 20} y={152} width="13" height="18" rx="3" fill="#ffd98a" />
        ))}
        <path d="M300 104V84" stroke="#5a648a" strokeWidth="3" />
        <path d="M284 84a16 16 0 0 1 32 0z" fill="#aeb7cc" stroke={INK} strokeWidth="3" />
        <circle className="st-beacon" cx="301" cy="119" r="4" fill="#ff5a4d" />
      </g>
      <g className="st-lost">
        <rect x="26" y="26" width="132" height="26" rx="13" fill="#02030a" opacity=".7" stroke="#ff5a4d" strokeWidth="2" />
        <circle cx="46" cy="39" r="5" fill="#ff5a4d" />
        <text x="62" y="44" fill="#ffb4ac" fontSize="13" fontWeight="700" letterSpacing="2" fontFamily="var(--space-font-display)">
          SEM SINAL
        </text>
      </g>
    </Frame>
  );
}

/** 2. A cabine escura e o botão vermelho ainda aceso. */
function SceneButton() {
  return (
    <Frame label="A cabine escura com um único botão vermelho aceso">
      <defs>
        <linearGradient id="st-cone" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff5a4d" stopOpacity=".5" />
          <stop offset="1" stopColor="#ff5a4d" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="st-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ff5a4d" stopOpacity=".7" />
          <stop offset="1" stopColor="#ff5a4d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="st-console" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16204d" />
          <stop offset="1" stopColor="#070b20" />
        </linearGradient>
      </defs>
      <rect width="640" height="320" fill="#03050e" />
      <rect x="150" y="26" width="340" height="104" rx="52" fill="#050a22" stroke="#243477" strokeWidth="4" />
      <Stars seed={3} n={22} className="st-drift-b" />
      <path d="M0 320V236c60-24 140-36 320-36s260 12 320 36v84z" fill="url(#st-console)" stroke="#2c3d8f" strokeWidth="3" />
      {[70, 104, 138, 502, 536, 570].map((x, i) => (
        <circle key={x} cx={x} cy={252 + (i % 3) * 8} r="5" fill="#2c3558" />
      ))}
      <g opacity=".5">
        <circle cx="44" cy="276" r="18" fill="none" stroke="#2c3558" strokeWidth="4" />
        <circle cx="596" cy="276" r="18" fill="none" stroke="#2c3558" strokeWidth="4" />
      </g>
      <polygon className="st-cone" points="296,214 344,214 470,34 170,34" fill="url(#st-cone)" />
      <g className="st-motes" fill="#ffb4ac">
        {[
          [250, 190],
          [290, 170],
          [330, 182],
          [372, 160],
          [270, 130],
          [350, 118],
          [312, 96],
          [236, 110],
        ].map(([x, y], i) => (
          <circle key={i} className="st-mote" style={{ ['--i' as string]: i }} cx={x} cy={y} r="2.4" />
        ))}
      </g>
      <circle className="st-halo" cx="320" cy="214" r="86" fill="url(#st-halo)" />
      <ellipse cx="320" cy="238" rx="64" ry="14" fill="#2b3552" />
      <ellipse cx="320" cy="230" rx="64" ry="14" fill="#c7cede" stroke={INK} strokeWidth="3" />
      <g className="st-btn">
        <rect x="278" y="200" width="84" height="30" fill="#b3140f" />
        <ellipse cx="320" cy="200" rx="42" ry="14" fill="#ee3a2f" stroke={INK} strokeWidth="3" />
        <ellipse cx="308" cy="195" rx="17" ry="4.5" fill="#fff" opacity=".5" />
      </g>
    </Frame>
  );
}

/** 3. O toque: onda de choque, uma estrela acende e solta poeira. */
function SceneIgnite() {
  const dust = [212, 246, 284, 326, 366, 402, 434, 262, 388];
  return (
    <Frame label="Um toque no botão faz uma estrela distante acender e soltar poeira estelar">
      <defs>
        <radialGradient id="st-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff3c2" />
          <stop offset=".35" stopColor="#ffd166" stopOpacity=".7" />
          <stop offset="1" stopColor="#ffd166" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="st-beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff5a4d" stopOpacity=".7" />
          <stop offset="1" stopColor="#ffd166" stopOpacity=".1" />
        </linearGradient>
      </defs>
      <rect width="640" height="320" fill="#03050e" />
      <Stars seed={11} n={50} className="st-drift-a" />
      <g className="st-sunwrap">
        <circle cx="320" cy="96" r="112" fill="url(#st-sun)" />
        <g className="st-rays" fill="#ffe29a" opacity=".9">
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d="M320 96l-5-86h10z" transform={`rotate(${i * 45} 320 96)`} opacity={i % 2 ? 0.45 : 0.85} />
          ))}
        </g>
        <path d="M320 54l9 33 33 9-33 9-9 33-9-33-33-9 33-9z" fill="#fff6d4" />
        <circle cx="320" cy="96" r="13" fill="#fff" />
      </g>
      <rect className="st-beam" x="316" y="110" width="8" height="150" fill="url(#st-beam)" />
      {dust.map((x, i) => (
        <circle key={x} className="st-fall" style={{ ['--i' as string]: i }} cx={x} cy={118 + (i % 3) * 8} r={2 + (i % 3)} fill="#ffd166" />
      ))}
      {[0, 1, 2].map((i) => (
        <ellipse key={i} className="st-wave" style={{ ['--i' as string]: i }} cx="320" cy="268" rx="46" ry="12" fill="none" stroke="#ff8d83" strokeWidth="3" />
      ))}
      <ellipse cx="320" cy="290" rx="60" ry="13" fill="#2b3552" />
      <ellipse cx="320" cy="283" rx="60" ry="13" fill="#c7cede" stroke={INK} strokeWidth="3" />
      <g className="st-press">
        <rect x="282" y="262" width="76" height="22" fill="#b3140f" />
        <ellipse cx="320" cy="262" rx="38" ry="12" fill="#ee3a2f" stroke={INK} strokeWidth="3" />
        <ellipse cx="309" cy="258" rx="15" ry="4" fill="#fff" opacity=".5" />
      </g>
    </Frame>
  );
}

const PLANETS = [
  { r: 62, size: 7, color: '#c7cede', cls: 'st-orb-a' },
  { r: 98, size: 9, color: '#e6a45c', cls: 'st-orb-b' },
  { r: 134, size: 11, color: '#5b8cff', cls: 'st-orb-c' },
] as const;

/** Os livros que abrem a 4ª cena: um comum, um raro e um épico do catálogo (os mesmos das cartas de escolha). */
const BOOKS = (
  [
    ['moon', 'common'],
    ['venus', 'rare'],
    ['sirius', 'epic'],
  ] as const
).flatMap(([id, rarity]) => {
  const def = GRIMOIRES.find((g) => g.id === id);
  return def ? [{ def, rarity }] : [];
});

/** 4. O sistema em órbita e os grimórios flutuando à frente. */
function SceneBooks() {
  return (
    <div className="ap-scene st-books-stage st-cam" aria-hidden="true">
      <svg viewBox="0 0 640 320" className="st-orbits">
        <defs>
          <radialGradient id="st-core" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#fff3c2" />
            <stop offset=".5" stopColor="#ffb347" stopOpacity=".6" />
            <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
          </radialGradient>
        </defs>
        <Stars seed={5} n={40} className="st-drift-b" />
        <circle cx="320" cy="160" r="46" fill="url(#st-core)" />
        {PLANETS.map((p) => (
          <g key={p.r}>
            <circle cx="320" cy="160" r={p.r} fill="none" stroke="#5b73d6" strokeWidth="2" opacity=".8" strokeDasharray="3 7" />
            <g className={p.cls}>
              <circle cx={320 + p.r} cy="160" r={p.size} fill={p.color} stroke={INK} strokeWidth="2" />
            </g>
          </g>
        ))}
      </svg>
      <div className="st-books">
        {/* As medalhas dos livros vêm do sprite de astros, que a tela de jogo monta mas a história não. */}
        <SpaceArtSprite />
        {BOOKS.map(({ def, rarity }, i) => (
          <div key={def.id} className="st-book" style={{ ['--i' as string]: i }}>
            <GrimoireBook rarity={artRarity(rarity)} astro={astroFor(def.id, def.family)} name={def.name} size="md" still />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StoryArt({ index }: { index: number }) {
  if (index === 0) return <SceneStation />;
  if (index === 1) return <SceneButton />;
  if (index === 2) return <SceneIgnite />;
  return <SceneBooks />;
}
