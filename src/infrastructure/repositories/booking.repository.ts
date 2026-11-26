import type { Booking, User } from '@prisma/client';
import type { BookingData } from '../../shared/types.js';
import { prisma } from '../prisma/index.js';
import { AppError } from '../../shared/errors/AppError.js';

export class BookingRepository {
  async findById(id: number): Promise<Booking | null> {
    // TODO: implementar operação de persistência.
    throw new AppError(501, 'NOT_IMPLEMENTED', 'Operação ainda não implementada.');
  }

  async findUser(id: number): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findRoomConflict(
    roomId: number,
    startAt: Date,
    endAt: Date,
    excludeId?: number
  ): Promise<Booking | null> {
    return prisma.booking.findFirst({
      where: {
        roomId,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        id: excludeId === undefined ? undefined : { not: excludeId }
      }
    });
  }

  async findUserConflict(
    userId: number,
    startAt: Date,
    endAt: Date,
    excludeId?: number
  ): Promise<Booking | null> {
    return prisma.booking.findFirst({
      where: {
        userId,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        id: excludeId === undefined ? undefined : { not: excludeId }
      }
    });
  }

  async create(data: BookingData): Promise<Booking> {
    return prisma.booking.create({ data });
  }

  async update(id: number, data: Omit<BookingData, "userId">): Promise<Booking> {
    // TODO: implementar operação de persistência.
    throw new AppError(501, 'NOT_IMPLEMENTED', 'Operação ainda não implementada.');
  }

  async delete(id: number): Promise<void> {
    // TODO: implementar operação de persistência.
    throw new AppError(501, 'NOT_IMPLEMENTED', 'Operação ainda não implementada.');
  }
}
