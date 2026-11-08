import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FS_MAP_NAMES, fsPreloadMap, type FsMapId } from '@nocap/games';
import { CounterFoxBackdrop } from './CounterFoxBackdrop';
import { CounterFoxEmblem } from './CounterFoxLogo';
import './counterfox-hub.css';
import './fs-map-gate.css';

/** Mapas com arquivos pesados: baixados só quando alguém escolhe (o tamanho serve de plano B quando o servidor não informa). */
const HEAVY: Partial<Record<FsMapId, { glb: string; plan: string; bytes: number }>> = {
  duna: { glb: 'duna/duna.glb', plan: 'duna/duna-plan.png', bytes: 5_770_000 },
};
const TIPS = [
  'Caixas e muretos de até um metro se vencem pulando.',
  'Compre na base: a tecla B abre a loja.',
  'Aperte M para abrir o mapa grande.',
  'O Long A, o Meio e os Túneis ligam as duas bases.',
  'Granadas de fumaça fecham a visão por alguns segundos.',
];
const base = () => `${import.meta.env.BASE_URL ?? '/'}models/foxshot/`.replace('//', '/');

/** Baixa um arquivo contando os bytes (o navegador guarda no cache, então a cena carrega o mesmo arquivo de graça depois). */
async function fetchCounting(url: string, planBytes: number, onBytes: (n: number) => void): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || planBytes;
  const reader = res.body.getReader();
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    got += value.length;
    onBytes(Math.min(1, got / total));
  }
}

/**
 * Tela de carregamento do mapa: para mapas pesados (Duna) baixa o modelo com barra de verdade, carrega os dados de colisão e só então mostra
 * o jogo. Os outros mapas passam direto, sem piscar. Anima só transform e opacity.
 */
export function FsMapGate({ mapId, children }: { mapId: FsMapId | string | undefined; children: ReactNode }) {
  const heavy = HEAVY[mapId as FsMapId];
  const [ready, setReady] = useState(!heavy);
  const [pct, setPct] = useState(0);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState(false);
  const [tip, setTip] = useState(0);
  const run = useRef(0);

  const load = useCallback(async () => {
    if (!heavy) return;
    const my = ++run.current;
    setError(false);
    setPct(0);
    setStage(0);
    try {
      const b = base();
      // 1) o desenho (barra real) e a planta; 2) os dados da colisão e da navegação
      const planP = fetch(b + heavy.plan).then((r) => r.blob());
      await fetchCounting(b + heavy.glb, heavy.bytes, (f) => run.current === my && setPct(Math.round(f * 88)));
      await planP;
      if (run.current !== my) return;
      setStage(1);
      setPct(92);
      await fsPreloadMap(mapId);
      if (run.current !== my) return;
      setStage(2);
      setPct(100);
      window.setTimeout(() => run.current === my && setReady(true), 450);
    } catch {
      if (run.current === my) setError(true);
    }
  }, [heavy, mapId]);

  useEffect(() => {
    setReady(!heavy);
    if (heavy) void load();
    return () => {
      run.current++;
    };
  }, [heavy, load]);

  useEffect(() => {
    if (ready || !heavy) return;
    const t = window.setInterval(() => setTip((n) => (n + 1) % TIPS.length), 3800);
    return () => window.clearInterval(t);
  }, [ready, heavy]);

  if (ready) return <>{children}</>;
  const name = FS_MAP_NAMES[mapId as FsMapId] ?? '';
  const stages = ['Baixando o modelo do mapa', 'Montando colisão e navegação', 'Pronto'];
  return (
    <div className="cfh fmg" role="status" aria-live="polite" data-testid="fmg">
      <CounterFoxBackdrop />
      <div className="fmg-card">
        <CounterFoxEmblem size={92} />
        <p className="fmg-kicker">Carregando mapa</p>
        <h2 className="fmg-name">{name}</h2>
        <div className="fmg-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <i style={{ transform: `scaleX(${pct / 100})` }} />
          <b />
        </div>
        <div className="fmg-row">
          <span data-testid="fmg-stage">{error ? 'Não foi possível baixar o mapa' : stages[stage]}</span>
          <span className="fmg-pct">{pct}%</span>
        </div>
        {error ? (
          <button type="button" className="fmg-retry" onClick={() => void load()} data-testid="fmg-retry">
            Tentar de novo
          </button>
        ) : (
          <p className="fmg-tip" key={tip}>
            {TIPS[tip]}
          </p>
        )}
      </div>
    </div>
  );
}
