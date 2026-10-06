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
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FriendsService } from './friends.service';

const searchSchema = z.object({ q: z.string().trim().min(2).max(30) });
const requestSchema = z.object({ username: z.string().trim().min(1).max(30) });
const usernameParam = z.string().trim().min(1).max(30);

@Controller()
@UseGuards(AuthGuard)
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get('users/search')
  search(
    @Req() req: AuthedRequest,
    @Query(new ZodValidationPipe(searchSchema)) query: z.infer<typeof searchSchema>,
  ) {
    return this.friends.search(req.user.id, query.q);
  }

  @Get('friends')
  list(@Req() req: AuthedRequest) {
    return this.friends.list(req.user.id);
  }

  @Post('friends/requests')
  @HttpCode(200)
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
