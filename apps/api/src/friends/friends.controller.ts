import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FriendsService } from './friends.service';

const searchSchema = z.object({ q: z.string().trim().min(2).max(30) });
const requestSchema = z.object({ username: z.string().trim().min(1).max(30) });
/** O que o app diz que a pessoa está fazendo: só o tipo e o id do jogo (texto curto, sem dado pessoal). */
const pingSchema = z
  .object({
    activity: z
      .object({
        state: z.enum(['game', 'room', 'menu']),
        game: z
          .string()
          .regex(/^[a-z0-9-]{1,24}$/)
          .nullable()
          .optional(),
      })
      .optional(),
  })
  .optional();
const usernameParam = z.string().trim().min(1).max(30);

@Controller()
@UseGuards(AuthGuard, RateLimitGuard)
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get('users/search')
  @RateLimit({ limit: 30, windowMs: 60_000 })
  search(
    @Req() req: AuthedRequest,
    @Query(new ZodValidationPipe(searchSchema)) query: z.infer<typeof searchSchema>,
  ) {
    return this.friends.search(req.user.id, query.q);
  }

  /** Batimento do app aberto: alimenta "online" e "visto por último" dos amigos. */
  @Post('me/ping')
  @HttpCode(200)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  async ping(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(pingSchema)) body: z.infer<typeof pingSchema>,
  ) {
    const a = body?.activity;
    await this.friends.ping(
      req.user.id,
      a ? { state: a.state, game: a.state === 'game' ? (a.game ?? null) : null } : null,
    );
    return { ok: true };
  }

  @Get('friends')
  list(@Req() req: AuthedRequest) {
    return this.friends.list(req.user.id);
  }

  @Post('friends/requests')
  @HttpCode(200)
  @RateLimit({ limit: 20, windowMs: 60_000 })
  request(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(requestSchema)) body: z.infer<typeof requestSchema>,
  ) {
    return this.friends.request(req.user.id, body.username);
  }

  @Post('friends/requests/:username/accept')
  @HttpCode(200)
  accept(
    @Req() req: AuthedRequest,
    @Param('username', new ZodValidationPipe(usernameParam)) username: string,
  ) {
    return this.friends.accept(req.user.id, username);
  }

  @Post('friends/requests/:username/decline')
  @HttpCode(200)
  decline(
    @Req() req: AuthedRequest,
    @Param('username', new ZodValidationPipe(usernameParam)) username: string,
  ) {
    return this.friends.decline(req.user.id, username);
  }

  @Delete('friends/:username')
  remove(
    @Req() req: AuthedRequest,
    @Param('username', new ZodValidationPipe(usernameParam)) username: string,
  ) {
    return this.friends.remove(req.user.id, username);
  }
}
