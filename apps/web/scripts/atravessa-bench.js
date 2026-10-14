// Benchmark repetivel do Atravessa!. Cole no javascript_tool (ou no console) com o jogo aberto em modo dev.
// Nao depende do rAF: chama __atrScene.render(...) direto e mede com performance.now().
(() => {
  const s = window.__atr, sc = window.__atrScene;
  if (!s || !sc) return { erro: 'jogo nao esta rodando (abra /atravessa e clique em Jogar)' };
  const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };
  const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const r2 = (n) => Math.round(n * 100) / 100;
  const count = () => { let meshes = 0, objs = 0; sc.scene.traverse((o) => { objs++; if (o.isMesh) meshes++; }); return { meshes, objs }; };
  // heroi imortal: sem isso o teleporte cai na frente de um carro e a simulacao para (alive=false)
  // (die() virou no-op: so mede custo, nao jogabilidade)
  s.die = function () {};
  const revive = () => { s.alive = true; s.end = null; s.killer = -1; };
  let T = 0;
  const render = () => { T += 16; sc.render(s, 0.016, T, null); };
  const teleport = (row) => {
    let r = row;
    while (s.world.lane(r).kind !== 'descanso') r++;
    s.row = r; s.best = r; s.hx = s.world.corridorAt(r); s.dark = r - 8; s.tick = 500; revive();
    return r;
  };
  const out = { biomas: {}, jogo: {}, simulacao: {} };
  for (const row of [8, 60, 100, 130, 190, 230]) {
    const r = teleport(row);
    for (let i = 0; i < 30; i++) render(); // aquece
    const ms = [], calls = [], tris = [];
    for (let i = 0; i < 120; i++) {
      const t0 = performance.now(); render(); ms.push(performance.now() - t0);
      const p = window.__atrPerf || {}; calls.push(p.calls || 0); tris.push(p.tris || 0);
    }
    const c = count();
    out.biomas['linha' + r] = { ms_medio: r2(avg(ms)), ms_p95: r2(q(ms, 0.95)), ms_max: r2(Math.max(...ms)), calls: Math.round(avg(calls)), tris: Math.round(avg(tris)), malhas: c.meshes, objetos: c.objs, geos: (window.__atrPerf || {}).geos };
  }
  // jogo real
  teleport(8);
  for (let i = 0; i < 30; i++) render();
  const ms = [], spikes = [];
  for (let i = 0; i < 600; i++) {
    revive();
    // alinha o heroi com a coluna livre da proxima linha de descanso (senao o passo e bloqueado e nao avanca)
    if (i % 14 === 0) { if (!s.move) s.hx = s.world.corridorAt(s.row + 1); s.input(0); }
    s.step();
    const t0 = performance.now(); render(); const d = performance.now() - t0; ms.push(d);
    if (d > 20) spikes.push({ quadro: i, ms: r2(d), row: s.row });
  }
  out.jogo = { ms_medio: r2(avg(ms)), ms_p95: r2(q(ms, 0.95)), ms_max: r2(Math.max(...ms)), spikes_gt20: spikes.length, spikes: spikes.slice(0, 15), linha_final: s.row };
  // simulacao pura
  const st = [];
  for (let i = 0; i < 600; i++) { revive(); const t0 = performance.now(); s.step(); st.push(performance.now() - t0); }
  out.simulacao = { ms_medio: r2(avg(st)), ms_p95: r2(q(st, 0.95)), ms_max: r2(Math.max(...st)) };
  return out;
})()
