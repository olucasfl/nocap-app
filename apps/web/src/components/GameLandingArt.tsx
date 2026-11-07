import type { ReactNode } from 'react';

/** Jogos com tela própria no Fox Cap! (spec 058, seção 10). */
export type LandingGame = 'atravessa' | 'bola' | 'pingpong' | 'desmorona';
/** O Fox Cap! sem jogo escolhido (sala nova) também tem tema. */
export type ThemeGame = LandingGame | 'foxcap';

/** Emblema (símbolo) de cada jogo: desenhado só para ele, não uma letra. */
export function Emblem({ game }: { game: ThemeGame }) {
  const body: Record<ThemeGame, ReactNode> = {
    // raposa de boné: o símbolo do Fox Cap!
    foxcap: (
      <>
        <circle cx="50" cy="50" r="44" fill="#ffb347" />
        <path d="M22 30 28 8 44 24ZM78 30 72 8 56 24Z" fill="#ff7a2e" />
        <ellipse cx="50" cy="58" rx="28" ry="24" fill="#ff8a3d" />
        <path d="M30 52q20 28 40 0q-6 26-20 26T30 52Z" fill="#fff3d6" />
        <path d="M26 40q24-26 48 0Z" fill="#3f82ff" />
        <path d="M70 40h14" stroke="#3f82ff" strokeWidth="7" strokeLinecap="round" />
        <circle cx="40" cy="54" r="4" fill="#0b0d1c" />
        <circle cx="60" cy="54" r="4" fill="#0b0d1c" />
      </>
    ),
    // raposa atravessando: faixa de pedestre e setas
    atravessa: (
      <>
        <circle cx="50" cy="50" r="44" fill="#ff5a4d" />
        <path d="M18 72h64M18 58h64M18 44h64" stroke="#fff6" strokeWidth="5" strokeDasharray="10 8" />
        <path d="M50 14 74 40H58v28H42V40H26Z" fill="#0b0d1c" />
        <path d="M38 24 44 14 50 22 56 14 62 24" fill="none" stroke="#ffd27a" strokeWidth="4" strokeLinejoin="round" />
      </>
    ),
    // bola de futebol com orelhas de raposa
    bola: (
      <>
        <circle cx="50" cy="54" r="38" fill="#fff" />
        <path d="M50 34 66 46 60 64H40L34 46Z" fill="#0f5a3a" />
        <path d="M50 34V16M66 46l16-6M60 64l10 16M40 64 30 80M34 46 18 40" stroke="#0f5a3a" strokeWidth="5" strokeLinecap="round" />
        <path d="M22 28 18 6 38 18ZM78 28 82 6 62 18Z" fill="#38d27a" />
      </>
    ),
    // raquete e bola
    pingpong: (
      <>
        <path d="M58 60 80 90" stroke="#d9a066" strokeWidth="13" strokeLinecap="round" />
        <circle cx="44" cy="42" r="32" fill="#8f1f2b" />
        <circle cx="44" cy="42" r="26" fill="#ff5a4d" />
        <path d="M26 34q10-14 26-8" stroke="#fff7" strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="82" cy="20" r="9" fill="#fff" />
      </>
    ),
    // chão de ladrilhos que racha e cai
    desmorona: (
      <>
        <path d="M10 30 50 14 90 30 50 46Z" fill="#ff9d2e" />
        <path d="M10 30v14L50 60V46Z" fill="#b65a10" />
        <path d="M90 30v14L50 60V46Z" fill="#8a3f08" />
        <path d="M50 46 44 56 52 62 46 74" stroke="#0b0d1c" strokeWidth="4" fill="none" strokeLinejoin="round" />
        <path d="M30 70 42 88 24 90ZM68 68 80 84 64 88Z" fill="#ff9d2e" opacity=".75" />
      </>
    ),
  };
  return (
    <svg className="gx-emblem" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {body[game]}
    </svg>
  );
}

/** Fundo temático de cada jogo (só transform e opacity se mexem). */
export function Backdrop({ game }: { game: ThemeGame }) {
  if (game === 'foxcap') {
    return (
      <div className="glb glb-fc" aria-hidden="true">
        <div className="glb-stars" />
        <div className="glb-moon" />
        <svg className="glb-hills" viewBox="0 0 1200 300" preserveAspectRatio="none" style={{ bottom: 0, height: '38%' }}>
          <path d="M0 220 Q200 120 420 200 T820 170 T1200 210 V300 H0Z" fill="#2a1630" />
          <path d="M0 262 Q260 190 520 250 T1000 240 T1200 262 V300 H0Z" fill="#120b1c" />
        </svg>
        <div className="glb-vig" />
      </div>
    );
  }
  if (game === 'atravessa') {
    return (
      <div className="glb glb-atr" aria-hidden="true">
        <div className="glb-sun" />
        <svg className="glb-city" viewBox="0 0 1200 220" preserveAspectRatio="none">
          <path d="M0 220V150h60v-40h50v60h40v-90h60v70h50v-30h70v60h60v-80h60v50h80v-60h70v90h60v-40h70v-50h50v110Z" fill="#2a1020" />
        </svg>
        <div className="glb-road">
          <i className="lane l1" />
          <i className="lane l2" />
          <b className="car c1" />
          <b className="car c2" />
          <b className="car c3" />
        </div>
        <div className="glb-river">
          <b className="log g1" />
          <b className="log g2" />
          <b className="log g3" />
        </div>
        <div className="glb-vig" />
      </div>
    );
  }
  if (game === 'bola') {
    return (
      <div className="glb glb-bola" aria-hidden="true">
        <div className="glb-lights">
          <i /> <i /> <i />
        </div>
        <svg className="glb-crowd" viewBox="0 0 1200 160" preserveAspectRatio="none">
          <path d="M0 160V70q30-30 60 0t60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0V160Z" fill="#0b2a22" />
        </svg>
        <div className="glb-pitch">
          <i className="stripe" />
          <i className="circle" />
          <i className="mid" />
          <b className="ball" />
        </div>
        <div className="glb-vig" />
      </div>
    );
  }
  if (game === 'pingpong') {
    return (
      <div className="glb glb-png" aria-hidden="true">
        <div className="glb-grid" />
        <div className="glb-table">
          <i className="net" />
          <i className="line" />
        </div>
        <b className="pball p1" />
        <b className="pball p2" />
        <b className="pball p3" />
        <div className="glb-vig" />
      </div>
    );
  }
  return (
    <div className="glb glb-dsm" aria-hidden="true">
      <div className="glb-glow" />
      <div className="glb-tiles">
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} className={`t t${i % 7}`} style={{ left: `${(i * 37) % 96}%`, animationDelay: `${-(i * 1.7) % 11}s` }} />
        ))}
      </div>
      <svg className="glb-floor" viewBox="0 0 1200 240" preserveAspectRatio="none">
        <path d="M0 240V120l180-30 160 40 200-34 180 38 260-40 220 30V240Z" fill="#2a0f12" />
        <path d="M320 130 340 160 300 190M780 124 760 160 800 200" stroke="#ff9d2e" strokeWidth="3" fill="none" />
      </svg>
      <div className="glb-vig" />
    </div>
  );
}

/** Quadro grande à direita (como o mapa do Counter Fox): uma ilustração de cima do jogo e a descrição. */
export function Showcase({ game }: { game: LandingGame }) {
  const art: Record<LandingGame, ReactNode> = {
    atravessa: (
      <svg viewBox="0 0 400 300" className="gx-art" aria-hidden="true">
        <rect width="400" height="300" fill="#2d2a38" />
        <rect y="0" width="400" height="60" fill="#3f8f4a" />
        <rect y="60" width="400" height="80" fill="#34343e" />
        <path d="M0 100h400" stroke="#ffd27a" strokeWidth="3" strokeDasharray="22 16" />
        <rect y="140" width="400" height="30" fill="#3f8f4a" />
        <rect y="170" width="400" height="70" fill="#2f80d8" />
        <rect y="240" width="400" height="60" fill="#3f8f4a" />
        <rect x="40" y="72" width="64" height="26" rx="6" fill="#ffd23f" />
        <rect x="250" y="104" width="64" height="26" rx="6" fill="#ff5a4d" />
        <rect x="120" y="182" width="100" height="22" rx="6" fill="#8a5a2b" />
        <rect x="260" y="208" width="90" height="22" rx="6" fill="#8a5a2b" />
        <circle cx="200" cy="268" r="14" fill="#ff8a3d" />
        <path d="M190 258 196 244 202 256 208 244 212 260" fill="#ff8a3d" />
      </svg>
    ),
    bola: (
      <svg viewBox="0 0 400 300" className="gx-art" aria-hidden="true">
        <rect width="400" height="300" fill="#1c7a4a" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={i * 70 - 10} y="0" width="35" height="300" fill="#1f8a53" />
        ))}
        <rect x="14" y="14" width="372" height="272" fill="none" stroke="#fff" strokeWidth="3" />
        <path d="M200 14v272" stroke="#fff" strokeWidth="3" />
        <circle cx="200" cy="150" r="38" fill="none" stroke="#fff" strokeWidth="3" />
        <rect x="14" y="100" width="40" height="100" fill="none" stroke="#fff" strokeWidth="3" />
        <rect x="346" y="100" width="40" height="100" fill="none" stroke="#fff" strokeWidth="3" />
        {[[90, 90], [110, 200], [150, 140]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill="#3f82ff" />)}
        {[[310, 100], [290, 210], [250, 150]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill="#ff8a3d" />)}
        <circle cx="200" cy="150" r="7" fill="#fff" />
      </svg>
    ),
    pingpong: (
      <svg viewBox="0 0 400 300" className="gx-art" aria-hidden="true">
        <rect width="400" height="300" fill="#10244f" />
        <path d="M60 80h280l40 150H20Z" fill="#1d5fd0" />
        <path d="M60 80h280l40 150H20Z" fill="none" stroke="#fff" strokeWidth="4" />
        <path d="M200 80v150" stroke="#fff" strokeWidth="3" />
        <path d="M44 150h312" stroke="#fff" strokeWidth="5" strokeDasharray="6 4" />
        <rect x="170" y="196" width="60" height="9" rx="3" fill="#ff8a3d" />
        <rect x="170" y="100" width="60" height="9" rx="3" fill="#ffd27a" />
        <circle cx="240" cy="150" r="9" fill="#fff" />
        <path d="M236 140q-40 -30 -76 -26" stroke="#fff6" strokeWidth="3" fill="none" strokeDasharray="4 6" />
      </svg>
    ),
    desmorona: (
      <svg viewBox="0 0 400 300" className="gx-art" aria-hidden="true">
        <rect width="400" height="300" fill="#1a0a10" />
        {Array.from({ length: 5 }, (_, r) => Array.from({ length: 7 }, (_, c) => {
          const gone = (r * 7 + c) % 6 === 2;
          const crack = (r * 7 + c) % 5 === 1;
          if (gone) return null;
          return (
            <rect key={`${r}-${c}`} x={22 + c * 50} y={30 + r * 50} width="44" height="44" rx="5" fill={crack ? '#d4761c' : '#ff9d2e'} stroke={crack ? '#7a3a0b' : 'none'} strokeWidth="3" />
          );
        }))}
        <circle cx="210" cy="130" r="13" fill="#ff8a3d" />
        <path d="M200 120 205 106 211 118 217 106 222 122" fill="#ff8a3d" />
        <circle cx="210" cy="130" r="26" fill="none" stroke="#fff4" strokeWidth="2" />
      </svg>
    ),
  };
  const text: Record<LandingGame, [string, string]> = {
    atravessa: ['Atravessa! · Infinito', 'Pule, desvie e atravesse estrada, trilho e rio. Vale a distância, com recorde e ranking.'],
    bola: ['Fut Fox · Futebol de raposas', 'De 2 a 4 times, com bots ou amigos. Corra, use o fôlego e ande até na parede e no teto.'],
    pingpong: ['Ping Fox! · 1 contra 1', 'A raquete bate de verdade: força, lob e efeito. Treine contra bots ou chame um amigo.'],
    desmorona: ['Desmorona! · O chão some', 'A cada passo o chão racha e cai. Vence o último de pé: de 1 a 7 bots ou com amigos.'],
  };
  return (
    <div className="gx-show" data-testid="gl-show">
      {art[game]}
      <p className="gx-show-t">{text[game][0]}</p>
      <p className="gx-show-d">{text[game][1]}</p>
    </div>
  );
}
