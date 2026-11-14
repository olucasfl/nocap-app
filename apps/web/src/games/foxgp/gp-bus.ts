/** Aviso de que algo do Fox GP que vale na conta mudou no aparelho (o `gp-account` escuta e sobe para o servidor). */
export const GP_CHANGED = 'nocap-gp-changed';
export function gpNotify() {
  try {
    window.dispatchEvent(new Event(GP_CHANGED));
  } catch {
    /* sem janela (teste): nada a avisar */
  }
}
