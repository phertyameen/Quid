import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';
import {
  ListMissionsQueryDto,
  MissionListSort,
} from './dto/list-missions-query.dto';

describe('MissionsController', () => {
  let controller: MissionsController;

  let missionsService: {
    listPublicMissions: jest.Mock;
    getMissionSubmissions: jest.Mock;
    getMission: jest.Mock;
  };

  beforeEach(() => {
    missionsService = {
      listPublicMissions: jest.fn(),
      getMissionSubmissions: jest.fn(),
      getMission: jest.fn(),
    };

    controller = new MissionsController(
      missionsService as unknown as MissionsService,
    );
  });

  it('forwards the public list query to the service unchanged', async () => {
    const query: ListMissionsQueryDto = {
      status: 'OPEN',
      sort: MissionListSort.NEWEST,
      limit: 12,
    };

    missionsService.listPublicMissions.mockResolvedValue(['mission']);

    await expect(controller.list(query)).resolves.toEqual(['mission']);
    expect(missionsService.listPublicMissions).toHaveBeenCalledWith(query);
  });

  it('delegates submissions to the service with the authenticated user address', async () => {
    missionsService.getMissionSubmissions.mockResolvedValue(['sub']);

    const result = await controller.submissions('mission-1', {
      user: { userId: 'user-1', address: '0xabc' },
    } as any);

    expect(result).toEqual(['sub']);
    expect(missionsService.getMissionSubmissions).toHaveBeenCalledWith(
      'mission-1',
      '0xabc',
    );
  });


  it('propagates ForbiddenException when user is not the mission owner', async () => {
    missionsService.getMissionSubmissions.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      controller.submissions('mission-1', {
        user: { userId: 'user-1', address: '0xother' },
      } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('propagates NotFoundException when mission does not exist', async () => {
    missionsService.getMissionSubmissions.mockRejectedValue(
      new NotFoundException(),
    );

    await expect(
      controller.submissions('nonexistent', {
        user: { userId: 'user-1', address: '0xabc' },
      } as any),
    ).rejects.toThrow(NotFoundException);
  });



  it('forwards the mission id to the service and returns the result', async () => {
    const mockMission = { id: 'mission-1', title: 'Test' };
    missionsService.getMission.mockResolvedValue(mockMission);

    await expect(controller.detail('mission-1')).resolves.toEqual(mockMission);
    expect(missionsService.getMission).toHaveBeenCalledWith('mission-1');
  });
});
