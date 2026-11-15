// Monta a campanha final do Mini Golf (spec 082): põe as 40 fases na ordem de dificuldade e grava levels/level-1..40.json.
// Fontes: as 20 fases do Open Golf (convert.mjs, pasta <og>) e as 20 fases novas (build-levels.mjs, ids 101 a 120, pasta <novas>).
// Uso: node tools/art/minigolf/assemble.mjs <pasta-og> <pasta-novas>
import fs from 'node:fs';
import path from 'node:path';

const [og, news] = process.argv.slice(2);
const dir = path.resolve('packages/games/src/minigolf/levels');
// ordem final: 1 a 4 bem simples; depois cresce em tamanho, obstáculos e truques (o = Open Golf, n = nova)
const ORDER = [
  'o3', 'o2', 'o4', 'n101', 'n201', 'o5', 'n202', 'n203', 'o9', 'n204',
  'n205', 'n140', 'n206', 'n207', 'n208', 'n209', 'n210', 'n211', 'n212', 'n141',
  'n213', 'n214', 'n215', 'n142', 'n216', 'n144', 'n218', 'n143', 'o15', 'n219',
  'o16', 'n220', 'o17', 'n221', 'o18', 'n222', 'n223', 'n224', 'o20', 'o1'
];
if (ORDER.length !== 40 || new Set(ORDER).size !== 40) throw new Error('ordem inválida');
ORDER.forEach((k, i) => {
  const from = k[0] === 'o' ? path.join(og, `level-${k.slice(1)}.json`) : path.join(news, `level-${k.slice(1)}.json`);
  const j = JSON.parse(fs.readFileSync(from, 'utf8'));
  j.id = i + 1;
  fs.writeFileSync(path.join(dir, `level-${i + 1}.json`), JSON.stringify(j));
});
for (let n = 101; n <= 240; n++) fs.rmSync(path.join(dir, `level-${n}.json`), { force: true });
fs.writeFileSync('tools/art/minigolf/campaign-order.json', JSON.stringify(ORDER));
console.log('ok:', ORDER.map((k, i) => `${i + 1}=${k}`).join(' '));
