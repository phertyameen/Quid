import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { MissionsService } from './missions.service';
import { ListMissionsQueryDto } from './dto/list-missions-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    address: string;
  };
}

@Controller('missions')
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  @Get()
  list(@Query() query: ListMissionsQueryDto): Promise<unknown> {
    return this.missionsService.listPublicMissions(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request & { user: { address: string } }): Promise<unknown> {
    return this.missionsService.getMyMissions(req.user.address);
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<unknown> {
    return this.missionsService.getMission(id);
  }

  @Get(':id/submissions')
  @UseGuards(JwtAuthGuard)
  submissions(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.missionsService.getMissionSubmissions(id, req.user.address);
  }
}
