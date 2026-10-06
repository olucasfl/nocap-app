const KEY = 'nocap-guest-id';
let memory: string | null = null;

/** Convidado: UUID salvo no aparelho. Vira conta na Etapa 2. */
export function getGuestId(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // storage bloqueado (modo privado): vale só nesta sessão
    memory ??= crypto.randomUUID();
    return memory;
  }
}
