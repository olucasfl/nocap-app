import { Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { InvitesService } from './invites.service';

const idParam = z.string().uuid();

@Controller('me/invites')
@UseGuards(AuthGuard)
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  /** Convites que a pessoa recebeu e ainda valem. O app consulta de tempos em tempos. */
  @Get()
  list(@Req() req: AuthedRequest) {
    return this.invites.listFor(req.user.id);
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(@Req() req: AuthedRequest, @Param('id', new ZodValidationPipe(idParam)) id: string) {
    return this.invites.decline(req.user.id, id);
  }
}
