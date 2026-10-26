import { newSave } from '@nocap/games';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Conflict } from './api-save-store';
import { SYNC_BACK, SYNC_STRIP, SyncView } from './SyncNotice';

const noop = () => {};
const base = newSave('a', 0);
const conflict: Conflict = {
  account: { ...base, collapses: 3 },
  accountRevision: 7,
  local: { ...base, collapses: 2 },
  merged: { ...base, collapses: 3 },
};
const view = (p: Partial<Parameters<typeof SyncView>[0]>) =>
  renderToStaticMarkup(
    <SyncView
      sync="saved"
      conflict={null}
      confirming={null}
      busy={false}
      failed={false}
      onChoose={noop}
      onCancel={noop}
      {...p}
    />,
  );

describe('aviso de sincronização', () => {
  it('não mostra nada quando está salvo ou salvando', () => {
    expect(view({ sync: 'saved' })).toBe('');
    expect(view({ sync: 'saving' })).toBe('');
  });

  it('avisa offline, erro e sessão encerrada com um ícone e um balão, sem travar o jogo', () => {
    for (const sync of ['offline', 'error', 'signed-out'] as const) {
      const html = view({ sync });
      expect(html).toContain('role="status"');
      expect(html).toContain(SYNC_STRIP[sync]!.slice(0, 20));
      expect(html).toContain('ap-net-ic');
      expect(html).not.toContain('dialog');
    }
  });

  it('depois de alguns segundos só o ícone fica; o texto continua no rótulo dele', () => {
    const html = view({ sync: 'offline', showToast: false });
    expect(html).toContain('ap-net-ic');
    expect(html).not.toContain('ap-net-toast');
    expect(html).toContain(`aria-label="${SYNC_STRIP.offline}"`);
  });

  it('com a internet de volta avisa uma vez, sem ícone', () => {
    const html = view({ sync: 'saved', recovered: true });
    expect(html).toContain(SYNC_BACK);
    expect(html).not.toContain('ap-net-ic');
    expect(view({ sync: 'saved', recovered: true, showToast: false })).toBe('');
  });

  it('conflito abre o diálogo com as 3 escolhas e os colapsos de cada lado', () => {
    const html = view({ sync: 'conflict', conflict });
    expect(html).toContain('Este save mudou em outro aparelho');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Juntar (recomendado)');
    expect(html).toContain('Usar o da conta');
    expect(html).toContain('Usar o deste aparelho');
    expect(html).toContain('3 colapsos');
    expect(html).toContain('2 colapsos');
  });

  it('a escolha que descarta pede o segundo passo e diz o que se perde', () => {
    const html = view({ sync: 'conflict', conflict, confirming: 'device' });
    expect(html).toContain('Sim, usar o deste aparelho');
    expect(html).toContain('Voltar');
    expect(html).toContain('Uma cópia dele fica guardada');
    expect(html).not.toContain('Juntar (recomendado)');
  });

  it('mostra a falha ao resolver', () => {
    expect(view({ sync: 'conflict', conflict, failed: true })).toContain('role="alert"');
  });

  it('o CSS só anima transform e opacity (e respeita movimento reduzido) e dá foco visível', () => {
    const css = readFileSync(join(__dirname, 'sync-notice.css'), 'utf8');
    expect(css).not.toMatch(/transition\s*:/);
    for (const [, body] of css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)) {
      for (const [, prop] of body!.matchAll(/([a-z-]+)\s*:/g))
        expect(['transform', 'opacity']).toContain(prop);
    }
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/\.ap-sync-btn:focus-visible/);
    expect(css).toMatch(/min-height:\s*48px/);
  });
});
