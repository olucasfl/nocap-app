/**
 * Mapa de altura do chão de uma pista de modelo (spec 086): onde o kart pisa (estrada, ponte, túnel, grama e areia), em
 * células de 1 m, com até dois andares por célula (a estrada embaixo e a ponte em cima). Gerado por
 * `tools/art/track/build-castle.mjs`. O desenho põe o kart na altura de verdade (as quatro rodas) em vez de seguir só a
 * linha central.
 */
interface Meta {
  x0: number;
  z0: number;
  w: number;
  h: number;
  cell: number;
}

const NONE = -32768;

export class GroundMap {
  private constructor(
    private meta: Meta,
    private low: Int16Array,
    private high: Int16Array,
  ) {}

  static async load(id: string): Promise<GroundMap> {
    const base = `/foxgp/${id}/`;
    const [meta, buf] = await Promise.all([
      fetch(`${base}ground.json`).then((r) => r.json() as Promise<Meta>),
      fetch(`${base}ground.bin`).then((r) => r.arrayBuffer()),
    ]);
    const n = meta.w * meta.h;
    return new GroundMap(meta, new Int16Array(buf, 0, n), new Int16Array(buf, n * 2, n));
  }

  /** O andar da célula mais perto de `hint` (m), ou null se não há chão ali. */
  private at(cx: number, cz: number, hint: number): number | null {
    const m = this.meta;
    if (cx < 0 || cz < 0 || cx >= m.w || cz >= m.h) return null;
    const i = cz * m.w + cx;
    const lo = this.low[i]!;
    if (lo === NONE) return null;
    const hi = this.high[i]!;
    const a = lo / 100;
    const b = hi / 100;
    return Math.abs(a - hint) <= Math.abs(b - hint) ? a : b;
  }

  /** Altura do chão em (x, z), interpolada, no andar mais perto de `hint`; null fora do chão. */
  sample(x: number, z: number, hint: number): number | null {
    const m = this.meta;
    const fx = (x - m.x0) / m.cell - 0.5;
    const fz = (z - m.z0) / m.cell - 0.5;
    const cx = Math.floor(fx);
    const cz = Math.floor(fz);
    const tx = fx - cx;
    const tz = fz - cz;
    // a célula mais perto manda: as vizinhas só entram se estiverem no mesmo andar (a ponte não "puxa" a estrada)
    const near = this.at(tx < 0.5 ? cx : cx + 1, tz < 0.5 ? cz : cz + 1, hint);
    if (near === null) return null;
    let sum = 0;
    let wsum = 0;
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 2; i++) {
        const y = this.at(cx + i, cz + j, near);
        if (y === null || Math.abs(y - near) > 1.2) continue;
        const w = (i ? tx : 1 - tx) * (j ? tz : 1 - tz);
        sum += y * w;
        wsum += w;
      }
    return wsum > 1e-6 ? sum / wsum : near;
  }
}
