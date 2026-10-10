import { Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard';
import { leaveMyRoom, myRoomInfo } from './color.room';

/**
 * "Em que sala eu estou?" e "sair dela", direto pelo servidor. O app usa para mostrar o aviso
 * "Você está na sala ..." e para o botão Sair funcionar mesmo quando a conexão da sala já caiu.
 */
@Controller('me/room')
@UseGuards(AuthGuard)
export class MeRoomController {
  @Get()
  current(@Req() req: AuthedRequest) {
    return { room: myRoomInfo(req.user.id) };
  }

  @Post('leave')
  @HttpCode(200)
  leave(@Req() req: AuthedRequest) {
    return { left: leaveMyRoom(req.user.id) };
  }
}
