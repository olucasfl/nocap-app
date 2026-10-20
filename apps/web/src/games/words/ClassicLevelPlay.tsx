import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import type { ClassicMode } from '@nocap/games';
import { ClassicPlay } from './ClassicPlay';
import { CLASSIC_KEYS, levelEngine } from './classic-engine';
import { loadClassicLevels, type ClassicLevel } from './levels/levels';
import { GridLoader, WordsShell } from './words-kit';
import { MODE_LABEL } from './words-api';

const isMode = (m: string | undefined): m is ClassicMode => m === 'classic' || m === 'dueto' || m === 'quarteto';

/** Uma fase do Classic: as palavras vêm do aparelho e o progresso fica salvo a cada palpite. */
export function ClassicLevelPlay() {
  const { modo, n } = useParams({ strict: false }) as { modo?: string; n?: string };
  const mode: ClassicMode = isMode(modo) ? modo : 'classic';
  const num = Number(n);
  const [levels, setLevels] = useState<ClassicLevel[] | null>(null);

  useEffect(() => {
    setLevels(null);
    void loadClassicLevels().then((all) => setLevels(all[CLASSIC_KEYS[mode]]));
  }, [mode]);

  const level = levels?.[num - 1];
  const engine = useMemo(() => (level ? levelEngine(mode, level, num) : null), [mode, level, num]);
  const back = `/words/classic/fases/${mode}`;

  if (!levels) {
    return (
      <WordsShell title={`Fase ${num}`} back={back} accent="green" className="cw-theme">
        <GridLoader />
      </WordsShell>
    );
  }
  if (!level || !engine) {
    return (
      <WordsShell title={MODE_LABEL[mode].name} back={back} accent="green" className="cw-theme">
        <p className="wd-error">Essa fase não existe.</p>
        <Link to="/words/classic/fases/$modo" params={{ modo: mode }} className="btn alt">
          Ver as fases
        </Link>
      </WordsShell>
    );
  }
  const hasNext = num < levels.length;
  return (
    <ClassicPlay
      key={`${mode}-${num}`}
      mode={mode}
      engine={engine}
      title={`Fase ${num}`}
      back={back}
      loading="Abrindo a fase..."
      endActions={() => (
        <>
          {hasNext ? (
            <Link to="/words/classic/fase/$modo/$n" params={{ modo: mode, n: String(num + 1) }} className="btn alt" data-testid="next">
              Próxima fase
            </Link>
          ) : null}
          <Link to="/words/classic/fases/$modo" params={{ modo: mode }} className="btn ghost" data-testid="back-catalog">
            Ver todas as fases
          </Link>
        </>
      )}
    />
  );
}
