import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { MissionsService } from './missions.service';
import { ListMissionsQueryDto } from './dto/list-missions-query.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

type AuthRequest = Request & { user: { address: string } };

@Controller('missions')
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  @Get()
  list(@Query() query: ListMissionsQueryDto): Promise<unknown> {
    return this.missionsService.listPublicMissions(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthRequest): Promise<unknown> {
    return this.missionsService.getMyMissions(req.user.address);
  }

  @UseGuards(JwtAuthGuard)
  @Post('draft')
  saveDraft(@Req() req: AuthRequest, @Body() body: string): Promise<{}> {
    return this.missionsService.saveDraft(req.user.address, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/submissions')
  submissions(@Param('id') id: string, @Req() req: AuthRequest): Promise<unknown> {
    return this.missionsService.getMissionSubmissions(id, req.user.address);
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<unknown> {
    return this.missionsService.getMission(id);
  }
}
