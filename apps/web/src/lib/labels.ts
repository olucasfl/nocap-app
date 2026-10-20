/** Nomes de jogos e modos para telas (recordes, amigos). */
const MODE_NAME: Record<string, string> = {
  classic: 'Clássico',
  flash: 'Flash',
  quick: 'Rápido',
  strict: 'Sem estourar',
  blind: 'Às cegas',
  sequence: 'Sequência',
  survival: 'Sobrevivência',
  escalada: 'Escalada',
  velocidade: 'Velocidade',
  reverso: 'Reverso',
  impostor: 'Intruso',
  'batida-passo': 'Eco Hero: Primeiro Passo',
  'batida-mare': 'Eco Hero: Maré Alta',
  'batida-frenesi': 'Eco Hero: Frenesi',
  infinito: 'Infinito',
  towers: 'Block Towers',
  dueto: '2 palavras',
  quarteto: '4 palavras',
  party: 'Mix Nocap',
  leader: 'Siga o Líder',
  room: 'Sala',
};
const GAME_NAME: Record<string, string> = {
  color: 'Mesmíssima',
  time: 'Já Deu?',
  eco: 'Ecooo',
  blocks: "Block's",
  atravessa: 'Atravessa!',
  wclassic: "Classic Word's",
};
const KIND_NAME: Record<string, string> = { solo: 'Solo', daily: 'Daily', room: 'Sala' };

export const gameLabel = (game: string) => GAME_NAME[game] ?? game;
export const modeLabel = (mode: string) => MODE_NAME[mode] ?? mode;
export const kindLabel = (kind: string) => KIND_NAME[kind] ?? kind;
