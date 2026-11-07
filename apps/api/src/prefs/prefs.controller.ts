import { Body, Controller, Get, HttpCode, Inject, Put, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
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
        binds: z.record(z.string().max(30), z.string().max(30)).refine((b) => Object.keys(b).length <= 40),
      })
      .partial(),
    mute: z.boolean(),
  })
  .partial()
  .strict();
export type PrefsInput = z.infer<typeof prefsSchema>;

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
    const [row] = await this.db.select({ data: userPrefs.data }).from(userPrefs).where(eq(userPrefs.userId, req.user.id));
    return (row?.data as PrefsInput | undefined) ?? {};
  }

  @Put()
  @HttpCode(200)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  async save(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(prefsSchema)) body: PrefsInput) {
    await this.db
      .insert(userPrefs)
      .values({ userId: req.user.id, data: body })
      .onConflictDoUpdate({ target: userPrefs.userId, set: { data: body, updatedAt: new Date() } });
    return { ok: true };
  }
}
