import { questions, words, type Row } from './build';

/** Clash Royale (só cartas). Lista aprovada pelo Lucas em 17/11/2026. tipo = tropa|campeao|feitico|construcao. */
const R: Row[] = [
  ['Knight (Cavaleiro)', 'Valkyrie (Valquíria)', 'tipo=tropa'], ['Archers (Arqueiras)', 'Musketeer (Mosqueteira)', 'tipo=tropa'], ['Musketeer (Mosqueteira)', 'Archers (Arqueiras)', 'tipo=tropa'],
  ['Giant (Gigante)', 'Royal Giant (Gigante Real)', 'tipo=tropa'], ['Royal Giant (Gigante Real)', 'Giant (Gigante)', 'tipo=tropa'], ['Golem', 'Lava Hound', 'tipo=tropa'],
  ['Lava Hound', 'Golem', 'tipo=tropa'], ['P.E.K.K.A', 'Mega Knight (Megacavaleiro)', 'tipo=tropa'], ['Mega Knight (Megacavaleiro)', 'P.E.K.K.A', 'tipo=tropa'],
  ['Mini P.E.K.K.A', 'Prince (Príncipe)', 'tipo=tropa'], ['Prince (Príncipe)', 'Dark Prince (Príncipe Sombrio)', 'tipo=tropa'], ['Dark Prince (Príncipe Sombrio)', 'Prince (Príncipe)', 'tipo=tropa'],
  ['Valkyrie (Valquíria)', 'Knight (Cavaleiro)', 'tipo=tropa'], ['Hog Rider (Corredor)', 'Miner (Mineiro)', 'tipo=tropa'], ['Miner (Mineiro)', 'Hog Rider (Corredor)', 'tipo=tropa'],
  ['Balloon (Balão)', 'Baby Dragon (Bebê Dragão)', 'tipo=tropa'], ['Baby Dragon (Bebê Dragão)', 'Balloon (Balão)', 'tipo=tropa'], ['Inferno Dragon (Dragão Infernal)', 'Electro Dragon (Dragão Elétrico)', 'tipo=tropa'],
  ['Electro Dragon (Dragão Elétrico)', 'Inferno Dragon (Dragão Infernal)', 'tipo=tropa'], ['Witch (Bruxa)', 'Wizard (Mago)', 'tipo=tropa'], ['Wizard (Mago)', 'Ice Wizard (Mago de Gelo)', 'tipo=tropa'],
  ['Ice Wizard (Mago de Gelo)', 'Electro Wizard (Mago Elétrico)', 'tipo=tropa'], ['Electro Wizard (Mago Elétrico)', 'Ice Wizard (Mago de Gelo)', 'tipo=tropa'], ['Princess (Princesa)', 'Archers (Arqueiras)', 'tipo=tropa'],
  ['Barbarians (Bárbaros)', 'Elite Barbarians (Bárbaros de Elite)', 'tipo=tropa'], ['Elite Barbarians (Bárbaros de Elite)', 'Barbarians (Bárbaros)', 'tipo=tropa'], ['Lumberjack (Lenhador)', 'Hunter (Caçador)', 'tipo=tropa'],
  ['Royal Ghost (Fantasma Real)', 'Lumberjack (Lenhador)', 'tipo=tropa'], ['Hunter (Caçador)', 'Executioner (Executor)', 'tipo=tropa'], ['Executioner (Executor)', 'Hunter (Caçador)', 'tipo=tropa'],
  ['Sparky', 'Electro Dragon (Dragão Elétrico)', 'tipo=tropa'], ['Ice Golem (Golem de Gelo)', 'Golem', 'tipo=tropa'], ['Ice Spirit (Espírito de Gelo)', 'Fire Spirit (Espírito de Fogo)', 'tipo=tropa'],
  ['Fire Spirit (Espírito de Fogo)', 'Ice Spirit (Espírito de Gelo)', 'tipo=tropa'], ['Battle Ram (Aríete de Batalha)', 'Hog Rider (Corredor)', 'tipo=tropa'], ['Giant Skeleton (Gigante Esqueleto)', 'Giant (Gigante)', 'tipo=tropa'],
  ['Fireball (Bola de Fogo)', 'Rocket (Foguete)', 'tipo=feitico'], ['Rocket (Foguete)', 'Fireball (Bola de Fogo)', 'tipo=feitico'], ['Lightning (Raio)', 'Zap', 'tipo=feitico'],
  ['Zap', 'Lightning (Raio)', 'tipo=feitico'], ['Arrows (Flechas)', 'The Log (Tronco)', 'tipo=feitico'], ['The Log (Tronco)', 'Arrows (Flechas)', 'tipo=feitico'],
  ['Poison (Veneno)', 'Graveyard (Cemitério)', 'tipo=feitico'], ['Graveyard (Cemitério)', 'Poison (Veneno)', 'tipo=feitico'], ['Freeze (Congelar)', 'Rage (Fúria)', 'tipo=feitico'],
  ['Tornado', 'Earthquake (Terremoto)', 'tipo=feitico'], ['X-Bow (X-Besta)', 'Mortar (Morteiro)', 'tipo=construcao'], ['Mortar (Morteiro)', 'X-Bow (X-Besta)', 'tipo=construcao'],
  ['Inferno Tower (Torre Inferno)', 'Tesla', 'tipo=construcao'], ['Tesla', 'Inferno Tower (Torre Inferno)', 'tipo=construcao'], ['Cannon (Canhão)', 'Bomb Tower (Torre de Bombas)', 'tipo=construcao'],
  ['Barbarian Hut (Cabana de Bárbaros)', 'Goblin Hut (Cabana de Goblins)', 'tipo=construcao'],
];
export const clashWords = words('clash', R);
export const clashQuestions = questions('clash', [
  ['Qual carta do Clash Royale você usa mais?', 'Qual carta do Clash Royale você nunca usaria?'],
  ['Qual carta é a mais forte do jogo?', 'Qual carta é a mais irritante de enfrentar?'],
  ['Qual carta você escolheria para atacar a torre?', 'Qual carta você escolheria para defender?'],
  ['Qual carta você chama de sua favorita?', 'Qual carta você acha a mais fraca?'],
]);
