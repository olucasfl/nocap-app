import { useMemo } from 'react';

/** Fundo do menu: céu de noite no deserto, lua, estrelas, dunas em camadas, poeira e uma mira girando (só transform e opacity). */
export function CounterFoxBackdrop() {
  const dust = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ left: (i * 37) % 100, d: 7 + ((i * 5) % 9), delay: -((i * 3) % 11) })), []);
  return (
    <div className="cfh-bg" aria-hidden="true">
      <div className="cfh-stars" />
      <div className="cfh-moon" />
      <svg className="cfh-dunes far" viewBox="0 0 1200 300" preserveAspectRatio="none">
        <path d="M0 200 Q150 120 300 190 T600 170 T900 150 T1200 190 V300 H0Z" fill="#3a1f45" />
        {/* silhueta de uma cidade de arcos e cúpulas */}
        <path d="M640 170v-40h20v-16q10-14 20 0v16h20v40zM720 170v-60h30v-14q15-18 30 0v14h30v60zM850 170v-35h40v35z" fill="#2a1638" />
      </svg>
      <svg className="cfh-dunes mid" viewBox="0 0 1200 300" preserveAspectRatio="none">
        <path d="M0 230 Q200 140 420 220 T820 200 T1200 230 V300 H0Z" fill="#2a1630" />
      </svg>
      <svg className="cfh-dunes near" viewBox="0 0 1200 300" preserveAspectRatio="none">
        <path d="M0 260 Q260 190 520 250 T1000 240 T1200 262 V300 H0Z" fill="#120b1c" />
      </svg>
      <div className="cfh-dust">
        {dust.map((p, i) => (
          <i key={i} style={{ left: `${p.left}%`, animationDuration: `${p.d}s`, animationDelay: `${p.delay}s` }} />
        ))}
      </div>
      <div className="cfh-reticle" />
      <div className="cfh-scan" />
      <div className="cfh-vig" />
    </div>
  );
}

