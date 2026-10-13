/** Id de quem joga a sala sem conta: nunca vira linha no banco (histórico, estatística, ranking). */
export const GUEST_PREFIX = 'guest:';
export const isGuestId = (id: string) => id.startsWith(GUEST_PREFIX);

export const NICK_MIN = 2;
export const NICK_MAX = 16;

export type NickCheck = { ok: true; nick: string } | { ok: false; error: string };

/**
 * O apelido de quem entra sem conta: vale só na sala. Letras, números, espaço, ponto, traço e
 * sublinhado; de 2 a 16 caracteres. O servidor confere (o app só ajuda a digitar).
 */
export function cleanNickname(raw: unknown): NickCheck {
  if (typeof raw !== 'string') return { ok: false, error: 'Coloque um apelido para entrar na sala.' };
  const nick = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  const size = [...nick].length;
  if (size < NICK_MIN) return { ok: false, error: `O apelido precisa de pelo menos ${NICK_MIN} caracteres.` };
  if (size > NICK_MAX) return { ok: false, error: `O apelido tem no máximo ${NICK_MAX} caracteres.` };
  if (!/^[\p{L}\p{N} ._-]+$/u.test(nick) || !/[\p{L}\p{N}]/u.test(nick)) {
    return { ok: false, error: 'Use só letras, números, espaço, ponto, traço e sublinhado.' };
  }
  return { ok: true, nick };
}

/** Chave de comparação: sem acento, maiúsculas nem separadores ("L.ucas" e "lucas" são o mesmo). */
export function nickKey(nick: string): string {
  return nick
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[ ._-]/g, '');
}

/** Os @usuários que o apelido imitaria (o que vale em conta é minúsculo e sem espaço). */
export function usernameLookalikes(nick: string): string[] {
  const lower = nick.normalize('NFC').toLowerCase();
  return [...new Set([lower, lower.replace(/ /g, '_'), lower.replace(/ /g, ''), nickKey(nick)])];
}

/** Limite de entradas de convidado por origem (contra quem abre salas em série). */
export function createGuestLimiter(max = 10, windowMs = 60_000, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  const allow = (key: string): boolean => {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((h) => t - h < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(t);
    hits.set(key, recent);
    return true;
  };
  allow.reset = () => hits.clear();
  return allow;
}
