import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MissionsService } from './missions.service';
import { MissionListSort } from './dto/list-missions-query.dto';
import { MissionStatus } from '@prisma/client';

const listInclude = {
  owner: { select: { address: true, displayName: true } },
  _count: { select: { submissions: true } },
};

const detailInclude = {
  owner: { select: { address: true, displayName: true, email: true } },
  _count: { select: { submissions: true } },
};

describe('MissionsService', () => {
  let service: MissionsService;
  let prisma: {
    mission: { findMany: jest.Mock; findUnique: jest.Mock };
    submission: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      mission: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      submission: {
        findMany: jest.fn(),
      },
    };

    service = new MissionsService(prisma as unknown as PrismaService);
  });

  describe('listPublicMissions', () => {
    it('applies filters, newest sort, and limit to the public mission query', async () => {
      prisma.mission.findMany.mockResolvedValue([]);

      await service.listPublicMissions({
        status: 'OPEN',
        sort: MissionListSort.NEWEST,
        limit: 5,
      });

      expect(prisma.mission.findMany).toHaveBeenCalledWith({
        where: { status: MissionStatus.OPEN },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: listInclude,
      });
    });

    it('normalizes lowercase status values before querying Prisma', async () => {
      prisma.mission.findMany.mockResolvedValue([]);

      await service.listPublicMissions({ status: 'open' });

      expect(prisma.mission.findMany).toHaveBeenCalledWith({
        where: { status: MissionStatus.OPEN },
        orderBy: { createdAt: 'desc' },
        take: undefined,
        include: listInclude,
      });
    });

    it('uses default newest ordering when no query params are provided', async () => {
      prisma.mission.findMany.mockResolvedValue([]);

      await service.listPublicMissions({});

      expect(prisma.mission.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: undefined,
        include: listInclude,
      });
    });

    it('supports oldest sorting for public mission discovery', async () => {
      prisma.mission.findMany.mockResolvedValue([]);

      await service.listPublicMissions({ sort: MissionListSort.OLDEST });

      expect(prisma.mission.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'asc' },
        take: undefined,
        include: listInclude,
      });
    });

    it('includes owner address, displayName, and submission count in list results', async () => {
      const mockMission = {
        id: 'mission-1',
        owner: { address: '0xabc', displayName: 'Alice' },
        _count: { submissions: 3 },
      };
      prisma.mission.findMany.mockResolvedValue([mockMission]);

      const result = (await service.listPublicMissions(
        {},
      )) as (typeof mockMission)[];

      expect(result[0].owner.address).toBe('0xabc');
      expect(result[0].owner.displayName).toBe('Alice');
      expect(result[0]._count.submissions).toBe(3);
    });
  });

  describe('getMission', () => {
    it('returns a mission with owner address, displayName, email, and submission count', async () => {
      const mockMission = {
        id: 'mission-1',
        owner: {
          address: '0xabc',
          displayName: 'Alice',
          email: 'alice@example.com',
        },
        _count: { submissions: 5 },
      };
      prisma.mission.findUnique.mockResolvedValue(mockMission);

      const result = (await service.getMission(
        'mission-1',
      )) as typeof mockMission;

      expect(prisma.mission.findUnique).toHaveBeenCalledWith({
        where: { id: 'mission-1' },
        include: detailInclude,
      });
      expect(result.owner.email).toBe('alice@example.com');
      expect(result._count.submissions).toBe(5);
    });

    it('throws NotFoundException when mission does not exist', async () => {
      prisma.mission.findUnique.mockResolvedValue(null);

      await expect(service.getMission('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMissionSubmissions', () => {
    it('returns submissions ordered by createdAt desc for the mission owner', async () => {
      prisma.mission.findUnique.mockResolvedValue({
        id: 'mission-1',
        ownerAddress: '0xabc',
      });
      const mockSubmissions = [
        { id: 'sub-2', createdAt: new Date('2026-01-02') },
        { id: 'sub-1', createdAt: new Date('2026-01-01') },
      ];
      prisma.submission.findMany.mockResolvedValue(mockSubmissions);

      const result = await service.getMissionSubmissions('mission-1', '0xabc');

      expect(result).toEqual(mockSubmissions);
      expect(prisma.submission.findMany).toHaveBeenCalledWith({
        where: { missionId: 'mission-1' },
        orderBy: { createdAt: 'desc' },
        include: {
          hunter: {
            select: {
              address: true,
              displayName: true,
            },
          },
        },
      });
    });

    it('throws NotFoundException when mission does not exist', async () => {
      prisma.mission.findUnique.mockResolvedValue(null);

      await expect(
        service.getMissionSubmissions('nonexistent', '0xabc'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not the mission owner', async () => {
      prisma.mission.findUnique.mockResolvedValue({
        id: 'mission-1',
        ownerAddress: '0xabc',
      });

      await expect(
        service.getMissionSubmissions('mission-1', '0xother'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
