import { useEffect, useRef } from 'react';

/** Folga do canvas em volta do cilindro (px de CSS): as chamas sobem mais do que descem. */
const PAD = { x: 24, top: 56, bottom: 16 };

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/**
 * Fogo procedural: ruído fractal que sobe com o tempo, recortado pela distância ao cilindro (chamas mais longas
 * em cima, curtas nos lados), com rampa de cor de brasa até o núcleo quase branco, brilho em volta e faíscas.
 */
const FRAG = `
precision highp float;
uniform vec2 uSize;   // tamanho do canvas em px de CSS
uniform float uDpr;
uniform vec4 uPill;   // centro x, centro y, meia largura, meia altura (y para baixo)
uniform float uTime;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; }
  return v;
}
float sdPill(vec2 p) {
  vec2 q = abs(p - uPill.xy) - uPill.zw + uPill.w;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uPill.w;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;
  float d = sdPill(p);

  // quanto "para cima" este ponto está: no topo a chama é longa, nos lados e embaixo é curta
  float up = clamp((uPill.y - p.y) / (uPill.w + 30.0), -0.6, 1.0);
  float len = mix(7.0, 44.0, smoothstep(-0.1, 0.85, up));

  // duas camadas de ruído subindo em velocidades diferentes, com o x balançando
  float sway = sin(uTime * 2.1 + p.y * 0.12) * 1.4;
  float n1 = fbm(vec2((p.x + sway) * 0.12, p.y * 0.075 + uTime * 1.6));
  float n2 = fbm(vec2(p.x * 0.22 + 4.0, p.y * 0.11 + uTime * 2.6));
  float n = mix(n1, n2, 0.4);

  float t = clamp(d / len, 0.0, 1.5);
  float heat = clamp(1.0 - t, 0.0, 1.0) * (0.22 + 1.7 * n);
  heat = smoothstep(0.12, 0.95, heat);

  vec3 col = mix(vec3(0.45, 0.03, 0.0), vec3(1.0, 0.30, 0.02), smoothstep(0.0, 0.40, heat));
  col = mix(col, vec3(1.0, 0.72, 0.14), smoothstep(0.35, 0.78, heat));
  col = mix(col, vec3(1.0, 0.96, 0.72), smoothstep(0.78, 1.0, heat));
  float alpha = smoothstep(0.02, 0.38, heat);

  // brilho quente em volta
  float halo = exp(-max(d, 0.0) / 14.0) * 0.30;
  vec3 glow = vec3(1.0, 0.34, 0.03) * halo;

  // faíscas subindo
  float sparks = 0.0;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float ph = fract(uTime * (0.16 + hash(vec2(fi, 3.1)) * 0.22) + hash(vec2(fi, 5.3)));
    vec2 sp = vec2(uPill.x + (hash(vec2(fi, 1.7)) - 0.5) * uPill.z * 2.1 + sin(uTime * 2.0 + fi * 2.3) * 5.0, uPill.y - uPill.w - 4.0 - ph * 42.0);
    sparks += smoothstep(1.7, 0.0, length(p - sp)) * (1.0 - ph);
  }
  vec3 spark = vec3(1.0, 0.78, 0.28) * sparks;

  vec3 rgb = col * alpha + glow + spark;
  float a = clamp(max(alpha, max(halo, sparks)), 0.0, 1.0);
  // some suave nas bordas do canvas (sem corte reto)
  float edge = min(min(p.x, uSize.x - p.x), min(p.y, uSize.y - p.y));
  float fade = smoothstep(0.0, 12.0, edge);
  gl_FragColor = vec4(rgb, a) * fade;
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/**
 * Fogo realista (WebGL) em volta do elemento pai, que precisa ser `position: relative`. Fica atrás do conteúdo e
 * não recebe toque. Para quando a aba some ou o fogo sai da tela; com "reduzir movimento" desenha um quadro só.
 * Sem WebGL o canvas simplesmente não aparece (o brilho em CSS continua).
 */
export function StreakFire() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uSize = u('uSize');
    const uDpr = u('uDpr');
    const uPill = u('uPill');
    const uTime = u('uTime');

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let visible = true;
    let size = { w: 0, h: 0, pw: 0, ph: 0, dpr: 1 };

    const resize = () => {
      const pw = host.offsetWidth;
      const ph = host.offsetHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = pw + PAD.x * 2;
      const h = ph + PAD.top + PAD.bottom;
      size = { w, h, pw, ph, dpr };
      canvas.style.left = `${-PAD.x}px`;
      canvas.style.top = `${-PAD.top}px`;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const draw = (ms: number) => {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uSize, size.w, size.h);
      gl.uniform1f(uDpr, size.dpr);
      gl.uniform4f(uPill, PAD.x + size.pw / 2, PAD.top + size.ph / 2, size.pw / 2, size.ph / 2);
      gl.uniform1f(uTime, ms / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const loop = (ms: number) => {
      draw(ms);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      if (reduce) draw(1500);
      else if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    resize();
    start();
    const ro = new ResizeObserver(() => {
      resize();
      start();
    });
    ro.observe(host);
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      if (visible) start();
      else cancelAnimationFrame(raf);
    });
    io.observe(host);
    document.addEventListener('visibilitychange', start);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', start);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return <canvas ref={ref} className="hz-fire-canvas" aria-hidden="true" />;
}
