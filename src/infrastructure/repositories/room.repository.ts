import type { Room } from '@prisma/client';
import type { RoomFilters } from '../../shared/types.js';
import { prisma } from '../prisma/index.js';

export class RoomRepository {
  async list(filters: RoomFilters): Promise<Room[]> {
    if (filters.minCapacity !== undefined && filters.minCapacity > 2147483647) {
      return [];
    }

    return prisma.room.findMany({
      where: {
        buildingId: filters.buildingId,
        type: filters.type,
        capacity: filters.minCapacity === undefined ? undefined : { gte: filters.minCapacity },
        active: filters.active,
        name: filters.name === undefined ? undefined : {
          contains: filters.name,
          mode: 'insensitive'
        }
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }]
    });
  }

  async findById(id: number): Promise<Room | null> {
    return prisma.room.findUnique({ where: { id } });
  }
}
