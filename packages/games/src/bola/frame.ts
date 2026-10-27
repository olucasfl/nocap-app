/**
 * Quadro do fluxo do Fut Fox em formato compacto (spec 048): posições, velocidades e direção viram inteiros (centésimos).
 * O servidor só manda assim para quem avisou que entende (`q: 1` ao entrar na sala); o resto continua recebendo o quadro
 * de sempre. Em MessagePack um inteiro pequeno ocupa 2 a 3 bytes e um decimal, 9: o quadro cai de ~460 para ~210 bytes
 * (6 raposas), o que reduz o tempo de cada envio e o estrago quando um pacote atrasa (TCP).
 */
type Frame = Record<string, unknown>;

const q = (n: number) => Math.round(n * 100);
const u = (n: number) => n / 100;

export function packBolaFrame(f: Frame): Frame {
  const b = f.b as number[];
  const p = f.p as number[][];
  return {
    ...f,
    q: 1,
    b: b.map(q),
    // [vaga, x, y, z, vx, vy, vz, direção, flags, ack, tempo do mortal, direção do mortal x, z, entrada x, z (centésimos), grude, normal da parede x, z]: só flags, ack e a entrada já são inteiros
    p: p.map((r) => [
      r[0],
      q(r[1]!),
      q(r[2]!),
      q(r[3]!),
      q(r[4]!),
      q(r[5]!),
      q(r[6]!),
      q(r[7]!),
      r[8],
      r[9],
      q(r[10] ?? 0),
      q(r[11] ?? 0),
      q(r[12] ?? 0),
      r[13] ?? 0,
      r[14] ?? 0,
      q(r[15] ?? 0),
      q(r[16] ?? 0),
      q(r[17] ?? 0),
    ]),
  };
}

/** Desfaz `packBolaFrame`; um quadro no formato antigo passa como está. */
export function unpackBolaFrame<T extends Frame>(f: T): T {
  if (f.q !== 1) return f;
  const b = f.b as number[];
  const p = f.p as number[][];
  const { q: _q, ...rest } = f;
  void _q;
  return {
    ...rest,
    b: b.map(u),
    p: p.map((r) => [
      r[0],
      u(r[1]!),
      u(r[2]!),
      u(r[3]!),
      u(r[4]!),
      u(r[5]!),
      u(r[6]!),
      u(r[7]!),
      r[8],
      r[9],
      u(r[10] ?? 0),
      u(r[11] ?? 0),
      u(r[12] ?? 0),
      r[13] ?? 0,
      r[14] ?? 0,
      u(r[15] ?? 0),
      u(r[16] ?? 0),
      u(r[17] ?? 0),
    ]),
  } as unknown as T;
}
