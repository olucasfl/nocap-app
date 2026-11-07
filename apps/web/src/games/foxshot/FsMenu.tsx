import { useEffect, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { toggleMute, useMuted } from '@/lib/sfx';
import {
  FS_ACTIONS, FS_CATS,
  bindLabel,
  useFsSettings,
  CROSS_COLORS,
  type CrosshairColor,
  type FsAction,
} from './fs-settings';
import { FsCrosshair } from './FsHud';

type Tab = 'jogo' | 'personalizar' | 'comandos';

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <label className="fsm-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <b className="mono">{fmt ? fmt(value) : value}</b>
    </label>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="fsm-row fsm-toggle"
      aria-pressed={value}
      onClick={() => onChange(!value)}
    >
      <span>{label}</span>
      <b className="mono">{value ? 'Ligado' : 'Desligado'}</b>
    </button>
  );
}

function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="fsm-row">
      <span>{label}</span>
      <div className="fsm-seg" role="radiogroup" aria-label={label}>
        {options.map(([v, t]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={v === value}
            className={v === value ? 'on' : ''}
            onClick={() => onChange(v)}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Comandos: lista de tudo, com o botão de cada ação; clicar e apertar uma tecla (ou botão do mouse) troca. Esc cancela. */
export function Commands({ touch }: { touch: boolean }) {
  const binds = useFsSettings((s) => s.binds);
  const bind = useFsSettings((s) => s.bind);
  const reset = useFsSettings((s) => s.reset);
  const [listen, setListen] = useState<FsAction | null>(null);

  useEffect(() => {
    if (!listen) return undefined;
    const kd = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      // Esc cancela; Backspace ou Delete tira a tecla da ação (fica sem tecla)
      if (e.code === 'Backspace' || e.code === 'Delete') bind(listen, '');
      else if (e.code !== 'Escape') bind(listen, e.code);
      setListen(null);
    };
    const md = (e: MouseEvent) => {
      // só os botões do mouse que o jogo entende
      if (e.button > 2) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      bind(listen, `Mouse${e.button}`);
      setListen(null);
    };
    window.addEventListener('keydown', kd, true);
    window.addEventListener('mousedown', md, true);
    return () => {
      window.removeEventListener('keydown', kd, true);
      window.removeEventListener('mousedown', md, true);
    };
  }, [listen, bind]);

  if (touch) {
    return (
      <ul className="fsm-help mono" data-testid="fsm-commands">
        <li>Joystick (esquerda da tela): andar</li>
        <li>Arrastar o dedo (direita da tela): olhar</li>
        <li>ATIRAR: botão laranja · MIRAR: botão amarelo</li>
        <li>PULAR, RECARGA e TROCAR: botões à direita</li>
        <li>No celular só joga com o aparelho deitado</li>
      </ul>
    );
  }
  return (
    <div data-testid="fsm-commands">
      <p className="fsm-hint mono">
        Clique numa ação e aperte a nova tecla (ou botão do mouse). Esc cancela, Backspace tira a tecla. Setas também andam.
      </p>
      {FS_CATS.map((cat) => (
      <section key={cat.id} className="fsm-cat" data-testid={`cat-${cat.id}`}>
      <h4>{cat.label}</h4>
      <ul className="fsm-binds">
        {cat.ids.map((id) => FS_ACTIONS.find((x) => x.id === id)!).map((a) => {
          // pegar do chão e a bomba dividem o E de propósito (uma serve para cada situação): não é conflito
          const twin = (x: string, y: string) => (x === 'pickup' && y === 'bomb') || (x === 'bomb' && y === 'pickup');
          const clash = FS_ACTIONS.filter((o) => o.id !== a.id && !twin(a.id, o.id) && binds[a.id] !== '' && binds[o.id] === binds[a.id]);
          return (
          <li key={a.id} className={clash.length ? 'conflict' : ''}>
            <span>
              {a.label}
              {clash.length > 0 && (
                <small className="fsm-warn" role="alert" data-testid={`conflict-${a.id}`}>
                  Em conflito com: {clash.map((c) => c.label).join(', ')}
                </small>
              )}
            </span>
            <button
              type="button"
              className={listen === a.id ? 'listen' : ''}
              onClick={() => setListen(a.id)}
              data-testid={`bind-${a.id}`}
            >
              {listen === a.id ? 'Aperte...' : bindLabel(binds[a.id])}
            </button>
            <button
              type="button"
              className="fsm-unbind"
              disabled={!binds[a.id]}
              onClick={() => {
                bind(a.id, '');
                setListen(null);
              }}
              title="Tirar o comando (fica vazio)"
              aria-label={`Tirar o comando de ${a.label}`}
              data-testid={`unbind-${a.id}`}
            >
              Tirar
            </button>
          </li>
          );
        })}
        {cat.id === 'general' && (
          <li className="fixed">
            <span>Soltar o mouse / abrir este menu</span>
            <b className="mono">Esc</b>
          </li>
        )}
        {cat.id === 'weapons' && (
          <li className="fixed">
            <span>Passar pelas armas e granadas</span>
            <b className="mono">Roda do mouse</b>
          </li>
        )}
      </ul>
      </section>
      ))}
      <button type="button" className="fsm-link" onClick={reset}>
        Restaurar tudo ao padrão
      </button>
    </div>
  );
}

export function Customize({ only }: { only?: 'aim' | 'screen' } = {}) {
  const s = useFsSettings();
  const muted = useMuted();
  const aim = only !== 'screen';
  const screen = only !== 'aim';
  return (
    <div data-testid="fsm-custom">
      {aim && (
        <>
      <h3>Mira e câmera</h3>
      <Slider
        label="Sensibilidade"
        value={s.sens}
        min={0.02}
        max={0.4}
        step={0.005}
        onChange={(v) => s.set({ sens: v })}
        fmt={(v) => v.toFixed(3)}
      />
      <Slider
        label="Sensibilidade ao mirar"
        value={s.adsSens}
        min={0.3}
        max={1.5}
        step={0.05}
        onChange={(v) => s.set({ adsSens: v })}
        fmt={(v) => `${v.toFixed(2)}x`}
      />
      <Slider
        label="Campo de visão"
        value={s.fov}
        min={60}
        max={100}
        step={1}
        onChange={(v) => s.set({ fov: v })}
        fmt={(v) => `${v}°`}
      />
      <Toggle
        label="Inverter o mouse (cima e baixo)"
        value={s.invertY}
        onChange={(v) => s.set({ invertY: v })}
      />
      <h3>Mira</h3>
      <div className="fsm-preview" aria-hidden="true">
        <FsCrosshair spreadPx={0} />
      </div>
      <Seg<CrosshairColor>
        label="Cor"
        value={s.crossColor}
        options={(Object.keys(CROSS_COLORS) as CrosshairColor[]).map((c) => [
          c,
          ({ white: 'Branca', green: 'Verde', lime: 'Limão', yellow: 'Amarela', orange: 'Laranja', red: 'Vermelha', pink: 'Rosa', purple: 'Roxa', blue: 'Azul', cyan: 'Ciano', black: 'Preta', custom: 'Outra...' } as Record<CrosshairColor, string>)[c],
        ])}
        onChange={(v) => s.set({ crossColor: v })}
      />
      {s.crossColor === 'custom' && (
        <label className="fsm-color">
          <span>Escolha a cor</span>
          <input type="color" value={s.crossCustom} onChange={(e) => s.set({ crossCustom: e.target.value })} data-testid="cross-custom" />
        </label>
      )}
      <Slider
        label="Tamanho"
        value={s.crossSize}
        min={3}
        max={18}
        step={1}
        onChange={(v) => s.set({ crossSize: v })}
      />
      <Slider
        label="Espessura"
        value={s.crossThick}
        min={1}
        max={5}
        step={1}
        onChange={(v) => s.set({ crossThick: v })}
      />
      <Slider
        label="Vão do centro"
        value={s.crossGap}
        min={0}
        max={14}
        step={1}
        onChange={(v) => s.set({ crossGap: v })}
      />
      <Toggle label="Ponto no centro" value={s.crossDot} onChange={(v) => s.set({ crossDot: v })} />
      <Toggle
        label="Abrir com a dispersão"
        value={s.crossDynamic}
        onChange={(v) => s.set({ crossDynamic: v })}
      />
        </>
      )}
      {screen && (
        <>
      <h3>Tela e som</h3>
      <Seg<FsSettingsQuality>
        label="Qualidade gráfica"
        value={s.quality}
        options={[
          ['auto', 'Automática'],
          ['low', 'Baixa'],
          ['mid', 'Média'],
          ['high', 'Alta'],
        ]}
        onChange={(v) => s.set({ quality: v })}
      />
      <Toggle
        label="Tela cheia e travar teclas (Ctrl+W não fecha o jogo)"
        value={s.fullscreenLock}
        onChange={(v) => s.set({ fullscreenLock: v })}
      />
      <Seg<'small' | 'medium' | 'large'>
        label="Tamanho do mapa no canto"
        value={s.minimapSize}
        options={[
          ['small', 'Pequeno'],
          ['medium', 'Médio'],
          ['large', 'Grande'],
        ]}
        onChange={(v) => s.set({ minimapSize: v })}
      />
      <Toggle
        label="Mapa no canto"
        value={s.showMinimap}
        onChange={(v) => s.set({ showMinimap: v })}
      />
      <Toggle
        label="Desempenho (fps)"
        value={s.showTelemetry}
        onChange={(v) => s.set({ showTelemetry: v })}
      />
      <Toggle label="Som" value={!muted} onChange={() => toggleMute()} />
        </>
      )}
    </div>
  );
}
type FsSettingsQuality = 'auto' | 'low' | 'mid' | 'high';

/** Menu do Esc do Counter Fox: jogo (continuar, encerrar, sair), personalizar e comandos. */
export function FsMenu({
  touch,
  onResume,
  onEnd,
  children,
  exitTo = '/fox-cap',
  exitLabel = 'Sair do Counter Fox',
  endLabel = 'Encerrar a partida',
  endConfirm = true,
  onBack,
  backLabel = 'Voltar ao menu do Counter Fox',
}: {
  touch: boolean;
  onResume: () => void;
  onEnd: () => void;
  children?: ReactNode;
  /** `null` esconde o botão de sair do Counter Fox (na sala online o jeito de sair é o botão da sala). */
  exitTo?: string | null;
  exitLabel?: string;
  /** Texto do botão de encerrar (e se pede um segundo toque para confirmar). */
  endLabel?: string;
  endConfirm?: boolean;
  /** Volta ao menu do Counter Fox (que é uma tela dentro da mesma página, então não dá para ser um link). */
  onBack?: () => void;
  backLabel?: string;
}) {
  const [tab, setTab] = useState<Tab>('jogo');
  const [sure, setSure] = useState(false);
  const TABS: [Tab, string][] = [
    ['jogo', 'Jogo'],
    ['personalizar', 'Personalizar'],
    ['comandos', 'Comandos'],
  ];
  return (
    <div className="fsm" role="dialog" aria-modal="true" aria-label="Menu" data-testid="fs-menu">
      <div className="fsm-card">
        <header>
          <h2>Counter Fox</h2>
          <nav role="tablist" aria-label="Seções">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? 'on' : ''}
                onClick={() => setTab(id)}
                data-testid={`fsm-tab-${id}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </header>
        <div className="fsm-body">
          {tab === 'jogo' && (
            <div className="fsm-game">
              <button
                type="button"
                className="fsm-main"
                onClick={onResume}
                data-testid="fsm-resume"
              >
                Continuar jogando
              </button>
              <button
                type="button"
                className={`fsm-item${sure ? ' sure' : ''}`}
                onClick={() => (!endConfirm || sure ? (setSure(false), onEnd()) : setSure(true))}
                onBlur={() => setSure(false)}
                data-testid="fsm-end"
              >
                {sure ? 'Toque de novo para confirmar' : endLabel}
              </button>
              {onBack && (
                <button type="button" className="fsm-item" data-sfx="back" onClick={onBack} data-testid="fsm-back">
                  {backLabel}
                </button>
              )}
              {exitTo && (
                <Link
                  to={exitTo}
                  className="fsm-item danger"
                  data-sfx="back"
                  data-testid="fsm-exit"
                >
                  {exitLabel}
                </Link>
              )}
              {children}
              <p className="fsm-hint mono">
                {touch ? 'Toque em Continuar jogando para voltar. ' : 'Esc abre e fecha este menu. '}
                {'As suas configurações valem na sua conta (e neste aparelho).'}
              </p>
            </div>
          )}
          {tab === 'personalizar' && <Customize />}
          {tab === 'comandos' && <Commands touch={touch} />}
        </div>
      </div>
    </div>
  );
}
