import { FoxBody } from './HubArt';
import './hub-art.css';

/**
 * As capas dos jogos soltos da tela inicial (Counter Fox, Fut Fox, Fox GP, Atravessa!, Ping Fox!, Desmorona! e Mini Golf):
 * no estilo das capas de Palavras, Cores e Mente. Um objeto grande de cada jogo, contorno de tinta, sombra dura, sem
 * moldura quadrada atrás (o fundo é a cor do cartão) e uma animação própria. Só `transform` e `opacity` se mexem, e tudo
 * para com movimento reduzido.
 */
const INK = '#111111';
const PAPER = '#f4f4ef';
const stroke = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const thin = { ...stroke, strokeWidth: 2.5 };
const hard = { fill: INK };

/** A raposa de boné no tamanho e lugar pedidos (a mesma da mascote). */
function Fox({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) translate(-80 -102)`}>
      <FoxBody />
    </g>
  );
}

/** Counter Fox: a raposa dentro da mira, com a lua e as dunas de fundo e a faísca do tiro. */
export function CounterFoxArt() {
  return (
    <svg className="ha ha-counter" viewBox="0 0 200 150" aria-hidden="true">
      <g className="ha-float c">
        <circle cx="166" cy="30" r="18" {...hard} transform="translate(4 4)" />
        <circle cx="166" cy="30" r="18" fill="#ffd9a0" {...stroke} />
        <circle cx="160" cy="26" r="4" fill="#f0b878" />
        <circle cx="172" cy="36" r="3" fill="#f0b878" />
      </g>
      <path d="M-4 134 Q40 106 86 126 T204 118 V154 H-4Z" fill="#6e3d8f" {...stroke} />
      <path d="M-4 146 Q60 128 112 142 T204 138 V154 H-4Z" fill="#4a2866" {...stroke} />
      <g className="ha-scope">
        <circle cx="100" cy="76" r="50" fill="none" stroke={INK} strokeWidth="11" />
        <circle cx="100" cy="76" r="50" fill="none" stroke="#ff7d26" strokeWidth="6" />
        <path d="M100 18v22M100 112v22M42 76h22M136 76h22" stroke={INK} strokeWidth="9" strokeLinecap="round" />
        <path d="M100 18v22M100 112v22M42 76h22M136 76h22" stroke="#ff7d26" strokeWidth="4.5" strokeLinecap="round" />
      </g>
      <g className="ha-bob">
        <Fox x={100} y={84} s={1.12} />
      </g>
      <g className="ha-spark">
        <path d="M146 56l5 9 9 5-9 5-5 9-5-9-9-5 9-5z" fill="#ffd23a" {...thin} />
      </g>
      <g className="ha-lines">
        <path d="M150 90h26M156 100h20" {...stroke} stroke={PAPER} strokeWidth="3" />
      </g>
    </svg>
  );
}

/** Fut Fox: a bola gigante rolando, a trave ao fundo e a raposa chutando. */
export function BolaArt() {
  const patch = 'M0 -9l8.5 6.2-3.2 10h-10.6l-3.2-10z';
  return (
    <svg className="ha ha-bola" viewBox="0 0 200 150" aria-hidden="true">
      <g transform="translate(118 20)">
        <path d="M0 0h58v52H0z" fill="rgba(255,255,255,.18)" />
        <path d="M0 52V0h58v52" fill="none" {...stroke} stroke={PAPER} />
        <path d="M0 13h58M0 26h58M0 39h58M14.5 0v52M29 0v52M43.5 0v52" stroke={PAPER} strokeWidth="1.4" opacity=".6" />
      </g>
      <ellipse cx="100" cy="134" rx="84" ry="11" fill="#1c8f5e" {...stroke} />
      <path d="M30 134h28M142 134h28" stroke={PAPER} strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <g className="ha-lines">
        <path d="M60 90h20M54 102h26M64 114h16" {...stroke} stroke={PAPER} strokeWidth="3" />
      </g>
      <Fox x={50} y={96} s={0.95} />
      <ellipse cx="124" cy="132" rx="30" ry="6" fill="rgba(0,0,0,.28)" />
      <g className="ha-float">
        <g transform="translate(124 88)">
          <circle r="40" {...hard} transform="translate(5 5)" />
          <g className="ha-spin slow">
            <circle r="40" fill={PAPER} {...stroke} />
            <path d={patch} transform="scale(1.35)" fill={INK} />
            <g fill={INK}>
              <path d={patch} transform="translate(0 -31) scale(.8) rotate(180)" />
              <path d={patch} transform="translate(30 -10) scale(.8) rotate(-72)" />
              <path d={patch} transform="translate(19 25) scale(.8) rotate(-144)" />
              <path d={patch} transform="translate(-19 25) scale(.8) rotate(144)" />
              <path d={patch} transform="translate(-30 -10) scale(.8) rotate(72)" />
            </g>
          </g>
          <path d="M-22 -26a36 36 0 0 1 30 -10" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".8" />
        </g>
      </g>
    </svg>
  );
}

/** Fox GP: o F1 laranja de lado, com a raposa no cockpit, rodas girando, bandeira quadriculada e a estrada correndo. */
export function FoxGpArt() {
  const wheel = (cx: number, r: number) => (
    <g transform={`translate(${cx} 112)`}>
      <circle r={r} fill="#1b1b1f" {...stroke} />
      <g className="ha-spin fast">
        <circle r={r * 0.5} fill="#ffd23a" {...thin} />
        <path d={`M0 ${-r * 0.5}V${r * 0.5}M${-r * 0.5} 0H${r * 0.5}`} stroke={INK} strokeWidth="2.6" />
      </g>
    </g>
  );
  return (
    <svg className="ha ha-gp" viewBox="0 0 200 150" aria-hidden="true">
      <g className="ha-flag" style={{ transformOrigin: '170px 56px' }}>
        <path d="M170 18v50" {...stroke} stroke={PAPER} strokeWidth="3" />
        <path d="M170 18h26v18h-26z" fill={PAPER} {...thin} />
        <path d="M170 18h8.7v9H170zM187.3 18H196v9h-8.7zM178.7 27h8.6v9h-8.6z" fill={INK} />
      </g>
      <g className="ha-lines">
        <path d="M6 82h28M0 96h30M10 110h22" {...stroke} stroke={PAPER} strokeWidth="3" />
      </g>
      <ellipse cx="104" cy="132" rx="66" ry="6" fill="rgba(0,0,0,.28)" />
      <g className="ha-run">
        <Fox x={104} y={86} s={0.62} />
        <path d="M40 100 L56 84 H70 V100Z" fill="#ff7d26" {...stroke} />
        <path d="M38 76h6v28h-6z" fill="#ffd23a" {...thin} />
        <path d="M26 74h26v6H26z" fill="#ff7d26" {...thin} />
        <path d="M48 106 L66 92 H112 L150 102 L178 104 V112 H48Z" fill="#ff7d26" {...stroke} />
        <path d="M70 100h38l22 5H70z" fill="#c8561a" opacity=".65" />
        <path d="M100 96h14l10 5h-24z" fill={PAPER} {...thin} />
        <path d="M156 114h34v6h-34z" fill="#ffd23a" {...thin} />
        <path d="M184 108v14" {...thin} />
        {wheel(66, 17)}
        {wheel(146, 15)}
      </g>
      <path d="M0 140h200" stroke={PAPER} strokeWidth="3" strokeDasharray="14 9" strokeLinecap="round" className="ha-road" />
    </svg>
  );
}

/** Atravessa!: uma faixa inclinada com grama, estrada e rio, o carro passando, a tora e a raposa pulando. */
export function AtravessaArt() {
  return (
    <svg className="ha ha-atr" viewBox="0 0 200 150" aria-hidden="true">
      <defs>
        <clipPath id="atr-clip">
          <rect x="22" y="22" width="156" height="106" rx="24" />
        </clipPath>
      </defs>
      <g transform="rotate(-9 100 75)">
        <rect x="22" y="22" width="156" height="106" rx="24" {...hard} transform="translate(5 6)" />
        <g clipPath="url(#atr-clip)">
          <rect x="20" y="20" width="160" height="38" fill="#7ed957" />
          <path d="M34 46l5-8 5 8M120 44l4-7 4 7" fill="none" stroke="#3fa535" strokeWidth="3" strokeLinecap="round" />
          <rect x="20" y="58" width="160" height="34" fill="#3d3d44" />
          <path d="M20 75h160" stroke={PAPER} strokeWidth="3" strokeDasharray="12 9" className="ha-road" />
          <rect x="20" y="92" width="160" height="38" fill="#4aa8ff" />
          <g className="ha-waves" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
            <path d="M34 106q5-5 10 0t10 0M126 118q5-5 10 0t10 0M70 112q5-5 10 0t10 0" />
          </g>
          <g className="ha-car">
            <rect x="40" y="62" width="34" height="18" rx="5" fill="#ffd23a" {...thin} />
            <rect x="48" y="65" width="14" height="8" rx="2" fill="#bfe7ff" />
            <circle cx="49" cy="81" r="4.5" fill={INK} />
            <circle cx="66" cy="81" r="4.5" fill={INK} />
          </g>
          <rect x="98" y="100" width="46" height="14" rx="7" fill="#b8793e" {...thin} />
          <path d="M108 100v14M120 100v14M132 100v14" stroke="#7a4a23" strokeWidth="2" />
        </g>
        <rect x="22" y="22" width="156" height="106" rx="24" fill="none" {...stroke} />
        <g className="ha-hop">
          <ellipse cx="108" cy="52" rx="14" ry="3.5" fill="rgba(0,0,0,.25)" />
          <Fox x={108} y={38} s={0.72} />
        </g>
      </g>
    </svg>
  );
}

/** Ping Fox!: a raquete vermelha batendo, a bolinha quicando e a raposa atrás da rede. */
export function PingArt() {
  return (
    <svg className="ha ha-ping" viewBox="0 0 200 150" aria-hidden="true">
      <ellipse cx="100" cy="132" rx="84" ry="12" fill="#1f46d8" {...stroke} />
      <path d="M22 132h156" stroke={PAPER} strokeWidth="3" opacity=".8" />
      <g>
        <path d="M96 106V84M168 106V84" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        <path d="M96 106h72V87H96z" fill="rgba(255,255,255,.55)" {...stroke} />
        <path d="M96 93h72M96 100h72M114 87v19M132 87v19M150 87v19" stroke="#9db4ff" strokeWidth="1.3" />
      </g>
      <Fox x={150} y={94} s={0.9} />
      <g className="ha-bounce">
        <ellipse cx="62" cy="128" rx="9" ry="2.6" fill="rgba(0,0,0,.28)" className="ha-bshadow" />
        <circle cx="62" cy="42" r="11" fill="#fff" {...stroke} />
        <path d="M55 38q7-5 14 0" fill="none" stroke="#ff7d26" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g className="ha-swing">
        <g transform="translate(32 96) rotate(-24)">
          <rect x="-5" y="22" width="10" height="26" rx="4" fill="#d9a066" {...stroke} />
          <circle r="28" {...hard} transform="translate(4 4)" />
          <circle r="28" fill="#ff4a4a" {...stroke} />
          <circle r="19" fill="#ff6a6a" {...thin} />
          <path d="M-12 -10q8-9 18-5" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity=".8" />
        </g>
      </g>
    </svg>
  );
}

/** Desmorona!: a raposa num ladrilho hexagonal, os vizinhos se soltando e a lava embaixo. */
export function DesmoronaArt() {
  const hexPts = (r: number) => Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');
  const tile = (x: number, y: number, cls: string, fill = '#9b6bff', top = '#b891ff') => (
    <g transform={`translate(${x} ${y})`}>
      <g className={cls}>
        <polygon points={hexPts(26)} transform="translate(0 9)" fill="#5a2fb3" {...stroke} />
        <polygon points={hexPts(26)} fill={fill} {...stroke} />
        <polygon points={hexPts(15)} fill={top} opacity=".55" />
      </g>
    </g>
  );
  return (
    <svg className="ha ha-dsm" viewBox="0 0 200 150" aria-hidden="true">
      <path d="M-4 138q14-9 28 0t28 0 28 0 28 0 28 0 28 0 28 0V154H-4Z" fill="#ffd23a" {...stroke} className="ha-lava" />
      <path d="M-4 146q14-7 28 0t28 0 28 0 28 0 28 0 28 0 28 0V154H-4Z" fill="#ff5a2a" />
      <g className="ha-ember a"><circle cx="40" cy="126" r="4" fill="#ffd23a" {...thin} /></g>
      <g className="ha-ember b"><circle cx="150" cy="122" r="3.4" fill="#ffd23a" {...thin} /></g>
      {tile(60, 106, 'ha-fall a', '#8a55f0', '#a77aff')}
      {tile(140, 104, 'ha-fall b', '#8a55f0', '#a77aff')}
      {tile(52, 64, 'ha-tile a')}
      {tile(148, 62, 'ha-tile b')}
      <g className="ha-tile c">
        {tile(100, 70, '')}
        <g className="ha-bob">
          <Fox x={100} y={62} s={0.82} />
        </g>
      </g>
      <g className="ha-spark"><path d="M30 28l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="#fff3a0" {...thin} /></g>
    </svg>
  );
}

/** Mini Golf: o gramado redondo com areia, o moinho girando, a bandeira no buraco e a bola com furinhos rolando. */
export function MiniGolfArt() {
  return (
    <svg className="ha ha-golf" viewBox="0 0 200 150" aria-hidden="true">
      <ellipse cx="100" cy="116" rx="90" ry="26" {...hard} transform="translate(0 6)" />
      <ellipse cx="100" cy="116" rx="90" ry="26" fill="#35a655" {...stroke} />
      <ellipse cx="100" cy="118" rx="70" ry="17" fill="#2e9a4c" opacity=".6" />
      <ellipse cx="58" cy="122" rx="24" ry="7.5" fill="#ecd9a0" {...thin} />
      <g transform="translate(112 84)">
        <path d="M-9 30L-5 0H5L9 30z" fill="#e8e0cc" {...stroke} />
        <path d="M-10 0L0 -14L10 0z" fill="#d9402f" {...stroke} />
        <g className="ha-spin slow" transform="translate(0 4)">
          <rect x="-3" y="-30" width="6" height="30" rx="2" fill={PAPER} {...thin} />
          <rect x="-3" y="0" width="6" height="30" rx="2" fill={PAPER} {...thin} />
          <rect x="-30" y="-3" width="30" height="6" rx="2" fill="#ff5a3c" {...thin} />
          <rect x="0" y="-3" width="30" height="6" rx="2" fill="#ff5a3c" {...thin} />
        </g>
        <circle cy="4" r="5" fill="#ffd23a" {...thin} />
      </g>
      <ellipse cx="162" cy="122" rx="11" ry="4.5" fill={INK} />
      <g className="ha-flag" style={{ transformOrigin: '162px 74px' }}>
        <path d="M162 122V70" {...stroke} stroke={PAPER} strokeWidth="3" />
        <path d="M162 70l26 9-26 9z" fill="#ff5a3c" {...thin} />
      </g>
      <path d="M72 92Q104 56 150 92" fill="none" stroke={PAPER} strokeWidth="3.5" strokeDasharray="1 9" strokeLinecap="round" className="ha-dots" />
      <g className="ha-float">
        <ellipse cx="58" cy="120" rx="12" ry="3.5" fill="rgba(0,0,0,.3)" />
        <g transform="translate(58 100)">
          <circle r="15" {...hard} transform="translate(3.5 3.5)" />
          <circle r="15" fill={PAPER} {...stroke} />
          <g fill="#c9c9c0">
            <circle cx="-5" cy="-5" r="1.7" /><circle cx="2" cy="-7" r="1.7" /><circle cx="7" cy="-1" r="1.7" />
            <circle cx="-8" cy="2" r="1.7" /><circle cx="-1" cy="1" r="1.7" /><circle cx="4" cy="7" r="1.7" />
            <circle cx="-6" cy="8" r="1.7" />
          </g>
          <path d="M-9 -8q5-6 11-5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
