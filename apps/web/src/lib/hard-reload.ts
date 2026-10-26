/**
 * Atualização à força: desregistra o service worker, apaga o cache e recarrega. Sem isso a versão velha
 * podia ficar presa (outra aba segurando o worker antigo, por exemplo) e o aviso voltava para sempre.
 */
export async function hardReload() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = (await globalThis.caches?.keys?.()) ?? [];
    await Promise.all(keys.map((k) => globalThis.caches.delete(k)));
  } catch {
    /* sem suporte: recarrega mesmo assim */
  }
  window.location.reload();
}
