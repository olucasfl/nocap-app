// Monta a campanha final do Mini Golf (spec 082): põe as 40 fases na ordem de dificuldade e grava levels/level-1..40.json.
// Fontes: as 20 fases do Open Golf (convert.mjs, pasta <og>) e as 20 fases novas (build-levels.mjs, ids 101 a 120, pasta <novas>).
// Uso: node tools/art/minigolf/assemble.mjs <pasta-og> <pasta-novas>
import fs from 'node:fs';
import path from 'node:path';

const [og, news] = process.argv.slice(2);
const dir = path.resolve('packages/games/src/minigolf/levels');
// ordem final: 1 a 4 bem simples; depois cresce em tamanho, obstáculos e truques (o = Open Golf, n = nova)
const ORDER = [
  'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9', 'o10',
  'o11', 'o12', 'o13', 'o14', 'o15', 'o16', 'o17', 'o18', 'o19', 'o20',
  'n250',
];
if (ORDER.length !== 21 || new Set(ORDER).size !== 21) throw new Error('ordem inválida');
ORDER.forEach((k, i) => {
  const from = k[0] === 'o' ? path.join(og, `level-${k.slice(1)}.json`) : path.join(news, `level-${k.slice(1)}.json`);
  const j = JSON.parse(fs.readFileSync(from, 'utf8'));
  j.id = i + 1;
  fs.writeFileSync(path.join(dir, `level-${i + 1}.json`), JSON.stringify(j));
});
for (let n = 22; n <= 260; n++) fs.rmSync(path.join(dir, `level-${n}.json`), { force: true });
fs.writeFileSync('tools/art/minigolf/campaign-order.json', JSON.stringify(ORDER));
console.log('ok:', ORDER.map((k, i) => `${i + 1}=${k}`).join(' '));
