import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Put,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { Db } from '../db/client';
import { DB } from '../db/db.module';
import { userPrefs } from '../db/schema';

export const prefsSchema = z
  .object({
    fs: z
      .object({
        sens: z.number().min(0.005).max(1),
        adsSens: z.number().min(0.1).max(3),
        fov: z.number().min(40).max(130),
        invertY: z.boolean(),
        crossColor: z.string().max(20),
        crossSize: z.number().min(0).max(60),
        crossCustom: z.string().max(9),
        crossThick: z.number().min(0).max(12),
        crossGap: z.number().min(0).max(40),
        crossDot: z.boolean(),
        crossDynamic: z.boolean(),
        showMinimap: z.boolean(),
        minimapSize: z.enum(['small', 'medium', 'large']),
        binds: z
          .record(z.string().max(30), z.string().max(30))
          .refine((b) => Object.keys(b).length <= 40),
      })
      .partial(),
    mute: z.boolean(),
  })
  .partial()
  .strict();
export type PrefsInput = z.infer<typeof prefsSchema>;

/**
 * A partida do Block Classic em andamento, guardada na conta para continuar em qualquer aparelho (spec 073): o suficiente para
 * refazê-la pela seed. Fica na mesma linha das preferências, na chave `blocksRun`, sem mexer no resto.
 */
export const blocksRunSchema = z
  .object({
    v: z.literal(1),
    matchId: z.string().min(8).max(64),
    seed: z.string().min(4).max(64),
    session: z.string().min(1).max(4000),
    moves: z.array(z.number().int().min(0).max(100_000)).min(1).max(3000),
    thumbs: z.number().int().min(0).max(3000),
    perfects: z.number().int().min(0).max(3000),
    hintsUsed: z.number().int().min(0).max(10),
    before: z.number().min(0).max(1_000_000_000),
    savedAt: z.number().int().min(0),
  })
  .strict();
export type BlocksRun = z.infer<typeof blocksRunSchema>;

/**
 * O que o Fox GP guarda na conta (14/11/2026): garagem (pelo e pinturas), comandos, melhor volta por pista, opções.
 * O servidor só limita formato e tamanho; o aparelho valida o conteúdo ao ler (os mesmos validadores do jogo).
 */
export const gpSchema = z
  .object({
    garage: z
      .record(z.string().max(20), z.unknown())
      .refine((g) => JSON.stringify(g).length <= 3000),
    binds: z.record(z.string().max(20), z.array(z.string().max(30)).length(2)).refine((b) => Object.keys(b).length <= 30),
    best: z.record(z.string().max(30), z.number().int().min(1).max(3_600_000)).refine((b) => Object.keys(b).length <= 10),
    shake: z.boolean(),
    physics: z.enum(['arcade', 'real']),
    vehicle: z.enum(['kart', 'f1']),
  })
  .partial()
  .strict();
export type GpSaved = z.infer<typeof gpSchema>;

/** O que o Mini Golf guarda na conta (spec 082): a bola e a melhor marca de cada fase. Sem migration: vive em `user_prefs`. */
export const golfSchema = z
  .object({
    ball: z
      .object({
        color: z.number().int().min(0).max(0xffffff),
        finish: z.enum(['liso', 'listras', 'pontos', 'metade', 'estrela']),
        trail: z.enum(['nenhum', 'faiscas', 'fogo', 'neve']),
      })
      .strict(),
    best: z.record(z.string().max(4), z.number().int().min(1).max(18)).refine((b) => Object.keys(b).length <= 60),
  })
  .partial()
  .strict();
export type GolfSaved = z.infer<typeof golfSchema>;

type StoredPrefs = PrefsInput & { blocksRun?: BlocksRun; gp?: GpSaved; golf?: GolfSaved };

/** Troca (ou apaga, com `null`) a partida guardada sem tocar nas preferências. */
export function withBlocksRun(data: StoredPrefs | undefined, run: BlocksRun | null): StoredPrefs {
  const rest: StoredPrefs = { ...(data ?? {}) };
  delete rest.blocksRun;
  return run ? { ...rest, blocksRun: run } : rest;
}

/** Ao gravar as preferências, a partida guardada continua onde estava. */
export function keepBlocksRun(existing: StoredPrefs | undefined, next: PrefsInput): StoredPrefs {
  const out: StoredPrefs = { ...next };
  if (existing?.blocksRun) out.blocksRun = existing.blocksRun;
  if (existing?.gp) out.gp = existing.gp;
  if (existing?.golf) out.golf = existing.golf;
  return out;
}

/** Junta o que o Fox GP mandou ao que a conta já tinha (a melhor volta nunca piora; o resto vale o último). */
export function mergeGp(old: GpSaved | undefined, next: GpSaved): GpSaved {
  const merged: GpSaved = { ...(old ?? {}), ...next };
  if (old?.best || next.best) {
    const best: Record<string, number> = { ...(old?.best ?? {}) };
    for (const [k, v] of Object.entries(next.best ?? {})) best[k] = best[k] === undefined ? v : Math.min(best[k]!, v);
    merged.best = best;
  }
  return merged;
}

/** Junta o que o Mini Golf mandou ao que a conta tinha (a menor marca de cada fase nunca piora; a bola vale a última). */
export function mergeGolf(old: GolfSaved | undefined, next: GolfSaved): GolfSaved {
  const merged: GolfSaved = { ...(old ?? {}), ...next };
  if (old?.best || next.best) {
    const best: Record<string, number> = { ...(old?.best ?? {}) };
    for (const [k, v] of Object.entries(next.best ?? {})) best[k] = best[k] === undefined ? v : Math.min(best[k]!, v);
    merged.best = best;
  }
  return merged;
}

/** As preferências da conta (spec 058): `GET` devolve as salvas ({} se nunca salvou); `PUT` grava (a última vale). */
@Controller('me/prefs')
@UseGuards(AuthGuard, RateLimitGuard)
export class PrefsController {
  constructor(@Inject(DB) private readonly maybeDb: Db | null) {}

  private get db(): Db {
    if (!this.maybeDb) throw new ServiceUnavailableException('Banco de dados não configurado');
    return this.maybeDb;
  }

  @Get()
  @RateLimit({ limit: 30, windowMs: 60_000 })
  async load(@Req() req: AuthedRequest): Promise<PrefsInput> {
    const [row] = await this.db
      .select({ data: userPrefs.data })
      .from(userPrefs)
      .where(eq(userPrefs.userId, req.user.id));
    return (row?.data as PrefsInput | undefined) ?? {};
  }

  @Put()
  @HttpCode(200)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  async save(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(prefsSchema)) body: PrefsInput,
  ) {
    const [row] = await this.db
      .select({ data: userPrefs.data })
      .from(userPrefs)
      .where(eq(userPrefs.userId, req.user.id));
    const data = keepBlocksRun(row?.data as StoredPrefs | undefined, body);
    await this.db
      .insert(userPrefs)
      .values({ userId: req.user.id, data })
      .onConflictDoUpdate({ target: userPrefs.userId, set: { data, updatedAt: new Date() } });
    return { ok: true };
  }

  @Get('gp')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  async loadGp(@Req() req: AuthedRequest): Promise<{ gp: GpSaved | null }> {
    const [row] = await this.db
      .select({ data: userPrefs.data })
      .from(userPrefs)
      .where(eq(userPrefs.userId, req.user.id));
    return { gp: (row?.data as StoredPrefs | undefined)?.gp ?? null };
  }

  @Put('gp')
  @HttpCode(200)
  @RateLimit({ limit: 60, windowMs: 60_000 })
  async saveGp(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(gpSchema)) body: GpSaved) {
    const [row] = await this.db
      .select({ data: userPrefs.data })
      .from(userPrefs)
      .where(eq(userPrefs.userId, req.user.id));
    const old = row?.data as StoredPrefs | undefined;
    const data: StoredPrefs = { ...(old ?? {}), gp: mergeGp(old?.gp, body) };
    await this.db
      .insert(userPrefs)
      .values({ userId: req.user.id, data })
      .onConflictDoUpdate({ target: userPrefs.userId, set: { data, updatedAt: new Date() } });
    return { gp: data.gp };
  }

  @Get('golf')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  async loadGolf(@Req() req: AuthedRequest): Promise<{ golf: GolfSaved | null }> {
    const [row] = await this.db
      .select({ data: userPrefs.data })
      .from(userPrefs)
      .where(eq(userPrefs.userId, req.user.id));
    return { golf: (row?.data as StoredPrefs | undefined)?.golf ?? null };
  }

  @Put('golf')
  @HttpCode(200)
  @RateLimit({ limit: 60, windowMs: 60_000 })
  async saveGolf(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(golfSchema)) body: GolfSaved) {
    const [row] = await this.db
      .select({ data: userPrefs.data })
      .from(userPrefs)
      .where(eq(userPrefs.userId, req.user.id));
    const old = row?.data as StoredPrefs | undefined;
    const data: StoredPrefs = { ...(old ?? {}), golf: mergeGolf(old?.golf, body) };
    await this.db
      .insert(userPrefs)
      .values({ userId: req.user.id, data })
      .onConflictDoUpdate({ target: userPrefs.userId, set: { data, updatedAt: new Date() } });
    return { golf: data.golf };
  }

  @Get('blocks-run')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  async loadBlocksRun(@Req() req: AuthedRequest): Promise<{ run: BlocksRun | null }> {
    const [row] = await this.db
      .select({ data: userPrefs.data })
      .from(userPrefs)
      .where(eq(userPrefs.userId, req.user.id));
    return { run: (row?.data as StoredPrefs | undefined)?.blocksRun ?? null };
  }

  @Put('blocks-run')
  @HttpCode(200)
  @RateLimit({ limit: 60, windowMs: 60_000 })
  async saveBlocksRun(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(blocksRunSchema)) body: BlocksRun,
  ) {
    return this.writeRun(req.user.id, body);
  }

  @Delete('blocks-run')
  @HttpCode(200)
  @RateLimit({ limit: 60, windowMs: 60_000 })
  async clearBlocksRun(@Req() req: AuthedRequest) {
    return this.writeRun(req.user.id, null);
  }

  private async writeRun(userId: string, run: BlocksRun | null) {
    const [row] = await this.db
      .select({ data: userPrefs.data })
      .from(userPrefs)
      .where(eq(userPrefs.userId, userId));
    const data = withBlocksRun(row?.data as StoredPrefs | undefined, run);
    await this.db
      .insert(userPrefs)
      .values({ userId, data })
      .onConflictDoUpdate({ target: userPrefs.userId, set: { data, updatedAt: new Date() } });
    return { ok: true };
  }
}
