/**
 * Texto das palavras do Word's (spec 032): a chave de comparação é a palavra sem acento, só a-z.
 * A pessoa digita sem acento e o jogo mostra a forma correta (`aviao` vira `avião`).
 */

/** A chave de comparação: minúsculas, sem acento, só de a a z. `Avião` e `aviao` têm a mesma chave. */
export function wordKey(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

/**
 * A chave que as cores usam (Classic): igual à `wordKey`, mas o `ç` continua sendo `ç`. Assim `c` e `ç`
 * nunca se confundem: o amarelo ou o verde num `ç` só aparecem quando a palavra certa tem `ç` mesmo
 * (e, no sentido contrário, um `c` comum nunca pinta um `ç`). Os outros acentos não importam.
 */
export function colorKey(word: string): string {
  let out = '';
  for (const ch of word.toLowerCase().normalize('NFC')) out += ch === 'ç' ? 'ç' : wordKey(ch);
  return out;
}

/** O texto digitado já é só letras (com ou sem acento), sem espaço nem número? */
export const isWordText = (text: string): boolean => /^[a-zà-üç]+$/i.test(text.normalize('NFC'));

/** O dicionário de uma lista: chave sem acento para a forma correta (com acento). */
export function buildDictionary(words: Iterable<string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const w of words) {
    const k = wordKey(w);
    if (k && !map.has(k)) map.set(k, w);
  }
  return map;
}
