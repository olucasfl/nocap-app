// Reordena as fases do Mini Golf por dificuldade medida pelo robô (spec 082). Uso:
//   node tools/art/minigolf/renumber.mjs /tmp/golf-rank-*.json   (os JSON saem de levels.rank.sim.ts)
// Renomeia levels/level-N.json, atualiza o id de cada fase e imprime as pars e as dificuldades prontas para o rules.ts.
// O mapa antigo -> novo fica em tools/art/minigolf/renumber.json (convert.mjs e build-levels.mjs o aplicam ao gerar).
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('packages/games/src/minigolf/levels');
const data = {};
for (const f of process.argv.slice(2)) Object.assign(data, JSON.parse(fs.readFileSync(f, 'utf8')));
const ids = Array.from({ length: 40 }, (_, i) => i + 1);
for (const n of ids) if (!data[n]) throw new Error(`falta a medição da fase ${n}`);

const score = (d) => (d.best ?? 7) * 10 + (1 - Math.min(d.ace, 0.2) / 0.2) * 6 + d.movers * 2 + (d.water > 0 ? 3 : 0);
const order = [...ids].sort((a, b) => score(data[a]) - score(data[b]) || a - b);
const map = {}; // antigo -> novo
order.forEach((old, i) => (map[old] = i + 1));

const par = (d) => (d.best === 1 ? (d.ace >= 0.03 ? 2 : 3) : d.best == null ? 5 : Math.min(5, d.best + 1));
const pars = order.map((old) => par(data[old]));
// pars nunca descem de uma fase para a seguinte dentro da ordem
for (let i = 1; i < pars.length; i++) pars[i] = Math.max(pars[i], pars[i - 1]);

// renomeia via nomes temporários (para um nome novo não pisar num antigo)
for (const old of ids) fs.renameSync(path.join(dir, `level-${old}.json`), path.join(dir, `tmp-${map[old]}.json`));
for (const n of ids) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, `tmp-${n}.json`), 'utf8'));
  j.id = n;
  fs.writeFileSync(path.join(dir, `level-${n}.json`), JSON.stringify(j));
  fs.unlinkSync(path.join(dir, `tmp-${n}.json`));
}
fs.writeFileSync('tools/art/minigolf/renumber.json', JSON.stringify(map, null, 1));
console.log('GOLF_PARS =', JSON.stringify(pars));
console.log('ordem (antigo por novo):', order.join(','));
console.log('easy 1-13, medium 14-27, hard 28-40');
