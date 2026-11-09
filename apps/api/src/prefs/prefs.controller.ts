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

type StoredPrefs = PrefsInput & { blocksRun?: BlocksRun };

/** Troca (ou apaga, com `null`) a partida guardada sem tocar nas preferências. */
export function withBlocksRun(data: StoredPrefs | undefined, run: BlocksRun | null): StoredPrefs {
  const rest: StoredPrefs = { ...(data ?? {}) };
  delete rest.blocksRun;
  return run ? { ...rest, blocksRun: run } : rest;
}

/** Ao gravar as preferências, a partida guardada continua onde estava. */
export function keepBlocksRun(existing: StoredPrefs | undefined, next: PrefsInput): StoredPrefs {
  return existing?.blocksRun ? { ...next, blocksRun: existing.blocksRun } : next;
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
