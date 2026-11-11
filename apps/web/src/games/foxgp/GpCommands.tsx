import { useEffect, useState } from 'react';
import { GP_ACTIONS, bindLabel, gpBindOwner, useGpControls, type GpAction } from './gp-settings';
import './theme.css';
import './gp-hud.css';

/**
 * Menu "Comandos" do Fox GP (spec 080, Fase 9), no molde da aba de comandos do Counter Fox: clicar num campo, apertar a
 * tecla nova; Esc cancela a captura (e o menu continua no Esc). Tecla já usada por outra ação: avisa e oferece trocar.
 * No celular, explica os botões de toque (sem remapear).
 */
export function GpCommands({ touch, onClose }: { touch: boolean; onClose: () => void }) {
  const binds = useGpControls((s) => s.binds);
  const bind = useGpControls((s) => s.bind);
  const reset = useGpControls((s) => s.reset);
  const [listen, setListen] = useState<{ action: GpAction; slot: 0 | 1 } | null>(null);
  const [clash, setClash] = useState<{
    action: GpAction;
    slot: 0 | 1;
    code: string;
    owner: GpAction;
  } | null>(null);

  useEffect(() => {
    if (!listen) return undefined;
    const kd = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === 'Escape') {
        setListen(null);
        return;
      }
      // Backspace ou Delete deixa o lugar vazio (só o secundário: a principal nunca fica sem tecla)
      if (e.code === 'Backspace' || e.code === 'Delete') {
        if (listen.slot === 1) bind(listen.action, 1, '');
        setListen(null);
        return;
      }
      const owner = gpBindOwner(binds, e.code, listen);
      if (owner && owner.action !== listen.action)
        setClash({ ...listen, code: e.code, owner: owner.action });
      else bind(listen.action, listen.slot, e.code, !!owner);
      setListen(null);
    };
    window.addEventListener('keydown', kd, true);
    return () => window.removeEventListener('keydown', kd, true);
  }, [listen, bind, binds]);

  // Esc fecha o painel (quando não está capturando nem perguntando)
  useEffect(() => {
    if (listen || clash) return undefined;
    const kd = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', kd, true);
    return () => window.removeEventListener('keydown', kd, true);
  }, [listen, clash, onClose]);

  const label = (id: GpAction) => GP_ACTIONS.find((a) => a.id === id)!.label;
  return (
    <div
      className="gpc"
      role="dialog"
      aria-modal="true"
      aria-label="Comandos"
      data-testid="gp-commands"
    >
      <div className="gpc-card gp-panel">
        <header>
          <h2>Comandos</h2>
          <button
            type="button"
            className="gp-tbtn"
            onClick={onClose}
            data-testid="gp-commands-close"
          >
            Fechar
          </button>
        </header>
        {touch ? (
          <ul className="gpc-touch">
            <li>
              <b>‹ ›</b> Botões da esquerda: virar
            </li>
            <li>
              <b>Acelera</b> Botão grande da direita; o <b>Freio</b> fica ao lado (parado, dá ré)
            </li>
            <li>
              <b>DRS</b> Abre a asa de trás na zona verde da reta (fecha sozinha ao frear)
            </li>
            <li>
              <b>Volta lançada</b> Na classificação, o botão grande embaixo leva você para a largada
            </li>
            <li>
              <b>Câmera</b> e <b>Menu</b>: em cima, à direita
            </li>
          </ul>
        ) : (
          <>
            <p className="gpc-hint">
              Clique num campo e aperte a tecla nova. Esc cancela; Backspace apaga a secundária. O
              menu é sempre o Esc.
            </p>
            <div className="gpc-head" aria-hidden="true">
              <span>Ação</span>
              <span>Principal</span>
              <span>Secundária</span>
            </div>
            <ul className="gpc-list">
              {GP_ACTIONS.map((a) => (
                <li key={a.id}>
                  <span>{a.label}</span>
                  {([0, 1] as const).map((slot) => {
                    const on = listen?.action === a.id && listen.slot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        className={`gpc-key${on ? ' is-listen' : ''}`}
                        onClick={() => setListen({ action: a.id, slot })}
                        data-testid={`gp-bind-${a.id}-${slot}`}
                        aria-label={`${a.label}, tecla ${slot === 0 ? 'principal' : 'secundária'}`}
                      >
                        {on
                          ? 'Pressione uma tecla'
                          : binds[a.id][slot]
                            ? bindLabel(binds[a.id][slot])
                            : '—'}
                      </button>
                    );
                  })}
                </li>
              ))}
              <li className="is-fixed">
                <span>Menu (pausa)</span>
                <b>Esc</b>
                <b>—</b>
              </li>
            </ul>
            {clash && (
              <div className="gpc-clash" role="alertdialog" data-testid="gp-bind-clash">
                <p>
                  <b>{bindLabel(clash.code)}</b> já é de <b>{label(clash.owner)}</b>. Trocar as
                  teclas?
                </p>
                <div>
                  <button
                    type="button"
                    className="gp-tbtn is-primary"
                    onClick={() => {
                      bind(clash.action, clash.slot, clash.code, true);
                      setClash(null);
                    }}
                    data-testid="gp-bind-swap"
                  >
                    Trocar
                  </button>
                  <button type="button" className="gp-tbtn" onClick={() => setClash(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            <button type="button" className="gpc-reset" onClick={reset} data-testid="gp-bind-reset">
              Restaurar padrão
            </button>
          </>
        )}
      </div>
    </div>
  );
}
