import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { summarizeProgress } from '@nocap/games';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { FriendsService } from '../friends/friends.service';
import { WordsProgressService } from './words-progress.service';

/** Em que fase um amigo está em cada jogo do Word's: só o resumo (nunca as palavras). Só amigos veem. */
@Controller('friends/:username/words-progress')
@UseGuards(AuthGuard, RateLimitGuard)
export class FriendWordsController {
  constructor(
    private readonly progress: WordsProgressService,
    private readonly friends: FriendsService,
  ) {}

  @Get()
  @RateLimit({ limit: 60, windowMs: 60_000 })
  async summary(@Req() req: AuthedRequest, @Param('username') username: string) {
    const friend = await this.friends.friendByUsername(req.user.id, username.trim().toLowerCase());
    return summarizeProgress(await this.progress.load(friend.id));
  }
}
