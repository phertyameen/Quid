import { Injectable, NotFoundException } from '@nestjs/common';
import { MissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ListMissionsQueryDto,
  MissionListSort,
} from './dto/list-missions-query.dto';

const missionListInclude = {
  owner: {
    select: {
      address: true,
      displayName: true,
    },
  },
  _count: {
    select: { submissions: true },
  },
} as const;

const missionDetailInclude = {
  owner: {
    select: {
      address: true,
      displayName: true,
      email: true,
    },
  },
  _count: {
    select: { submissions: true },
  },
} as const;

@Injectable()
export class MissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublicMissions(query: ListMissionsQueryDto): Promise<unknown> {
    const normalizedStatus = query.status?.toUpperCase() as
      | MissionStatus
      | undefined;
    const where = normalizedStatus ? { status: normalizedStatus } : {};
    const orderBy = {
      createdAt: query.sort === MissionListSort.OLDEST ? 'asc' : 'desc',
    } as const;

    const missions = await this.prisma.mission.findMany({
      where,
      orderBy,
      take: query.limit,
      include: missionListInclude,
    });

    return missions as unknown;
  }

  async getMission(id: string): Promise<unknown> {
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: missionDetailInclude,
    });

    if (!mission) {
      throw new NotFoundException(`Mission ${id} not found`);
    }

    return mission as unknown;
  }
}
