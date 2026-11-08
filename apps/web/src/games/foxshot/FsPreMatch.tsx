/** Tela de abertura da partida (antes da contagem acabar): o mapa e o modo, seu lado, o objetivo e a contagem; cobre a cena, que ainda não existe. */
export function FsPreMatch({
  count,
  kind,
  map,
  side,
  winRounds,
  names,
  pvp,
}: {
  count: number;
  kind: 'bomb' | 'dm';
  map: string;
  side: 'tr' | 'ct' | null;
  winRounds: number;
  names: string[];
  pvp?: boolean;
}) {
  const bomb = kind === 'bomb';
  return (
    <div className={`fsp-intro${bomb ? ' bomb' : ''}${side ? ` ${side}` : ''}`} data-testid="fsp-intro">
      <small className="fsp-chip">{pvp ? 'MODO PVP' : bomb ? 'MODO BOMBA' : 'MATA-MATA'} · {map.toUpperCase()}</small>
      {bomb && (
        <div className="fsp-side">
          <b>{side === 'tr' ? 'Você é Terrorista' : side === 'ct' ? 'Você é Contra-terrorista' : 'Você vai assistir'}</b>
          <span>
            {pvp
              ? side
                ? 'Sem bomba: elimine o outro time. Morreu, você assiste até o round acabar.'
                : 'Acompanhe os jogadores até o fim do round.'
              : side === 'tr'
                ? 'Pegue a C4 (Z), leve até a bomba A ou B e plante. Depois proteja até explodir.'
                : side === 'ct'
                  ? 'Impeça a plantação. Se a C4 for plantada, desarme segurando E antes que exploda.'
                  : 'Acompanhe os aliados até o fim do round.'}
          </span>
          <span>{pvp ? `Primeiro a ${winRounds} pontos vence. Dinheiro infinito: compre qualquer arma na fase de compra.` : `Primeiro a ${winRounds} rounds vence. Compre na base durante a fase de compra.`}</span>
        </div>
      )}
      {!bomb && (
        <div className="fsp-side">
          <b>Todos contra todos</b>
          <span>Você nasce protegido: a proteção acaba ao se mover ou atirar.</span>
        </div>
      )}
      {names.length > 0 && <p className="fsp-names">{names.join(' · ')}</p>}
      <small className="fsp-label">COMEÇA EM</small>
      <b className="fsp-num" key={count}>
        {count}
      </b>
    </div>
  );
}
