import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AccountService } from './account.service';

const usernameSchema = z.object({ username: z.string().max(60) });

@Controller()
@UseGuards(AuthGuard, RateLimitGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  /** @ atual e quando dá para trocar de novo. */
  @Get('me/username')
  status(@Req() req: AuthedRequest) {
    return this.account.status(req.user.id);
  }

  @Post('me/username')
  @HttpCode(200)
  @RateLimit({ limit: 10, windowMs: 60_000 })
  change(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(usernameSchema)) body: z.infer<typeof usernameSchema>,
  ) {
    return this.account.changeUsername(req.user.id, body.username);
  }
}
