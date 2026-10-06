/** Recorde local (o oficial vem do servidor na Etapa 2). Guardado em décimos (500 = 50.0). */
const key = (game: string) => `nocap-best-${game}`;

export function getBest(game: string): number | null {
  try {
    const raw = localStorage.getItem(key(game));
    return raw === null ? null : Number(raw) / 10;
  } catch {
    return null;
  }
}

export function saveBest(game: string, total: number) {
  try {
    const tenths = Math.round(total * 10);
    const current = localStorage.getItem(key(game));
    if (current === null || tenths > Number(current)) {
      localStorage.setItem(key(game), String(tenths));
    }
  } catch {
    /* sem storage: sem recorde local */
  }
}
