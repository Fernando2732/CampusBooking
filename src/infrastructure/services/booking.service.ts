import type { Booking } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { CreateBooking, UpdateBooking } from '../../shared/types.js';
import { BookingRepository } from '../repositories/booking.repository.js';
import { RoomRepository } from '../repositories/room.repository.js';
import { AppError } from '../../shared/errors/AppError.js';

const RECIFE_OFFSET_MS = 3 * 60 * 60 * 1000;
const MAX_DURATION_MS = 2 * 60 * 60 * 1000;

export class BookingService {
  private repo = new BookingRepository();
  private roomRepo = new RoomRepository();

  async create(data: CreateBooking): Promise<Booking> {
    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    this.validateSchedule(startAt, endAt);

    const user = await this.repo.findUser(data.userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
    }
    await this.ensureRoomAvailable(data.roomId, data.userId, startAt, endAt);

    return this.saveOrConflict(() => this.repo.create({ ...data, startAt, endAt }));
  }

  async update(id: number, data: UpdateBooking): Promise<Booking> {
    const current = await this.findNotStarted(id);

    const roomId = data.roomId ?? current.roomId;
    const startAt = data.startAt === undefined ? current.startAt : new Date(data.startAt);
    const endAt = data.endAt === undefined ? current.endAt : new Date(data.endAt);
    const purpose = data.purpose ?? current.purpose;
    this.validateSchedule(startAt, endAt);
    await this.ensureRoomAvailable(roomId, current.userId, startAt, endAt, id);

    return this.saveOrConflict(() => this.repo.update(id, { roomId, startAt, endAt, purpose }));
  }

  async delete(id: number): Promise<void> {
    await this.findNotStarted(id);
    await this.repo.delete(id);
  }

  private async findNotStarted(id: number): Promise<Booking> {
    const booking = await this.repo.findById(id);
    if (!booking) {
      throw new AppError(404, 'BOOKING_NOT_FOUND', 'Reserva não encontrada.');
    }
    if (booking.startAt.getTime() <= Date.now()) {
      throw new AppError(409, 'BOOKING_ALREADY_STARTED', 'A reserva já começou e não pode ser alterada ou cancelada.');
    }
    return booking;
  }

  private validateSchedule(startAt: Date, endAt: Date): void {
    if (endAt.getTime() <= startAt.getTime()) {
      throw new AppError(400, 'INVALID_BOOKING_INTERVAL', 'O término deve ser posterior ao início.');
    }
    if (startAt.getTime() <= Date.now()) {
      throw new AppError(400, 'BOOKING_START_NOT_FUTURE', 'O início da reserva deve estar no futuro.');
    }
    if (endAt.getTime() - startAt.getTime() > MAX_DURATION_MS) {
      throw new AppError(400, 'BOOKING_TOO_LONG', 'A reserva pode durar no máximo duas horas.');
    }

    const localStart = new Date(startAt.getTime() - RECIFE_OFFSET_MS);
    const localEnd = new Date(endAt.getTime() - RECIFE_OFFSET_MS);
    if (localStart.toISOString().slice(0, 10) !== localEnd.toISOString().slice(0, 10)) {
      throw new AppError(400, 'BOOKING_CROSSES_DAYS', 'A reserva não pode atravessar dias em Recife.');
    }
    const startMinutes = localStart.getUTCHours() * 60 + localStart.getUTCMinutes();
    const endMinutes = localEnd.getUTCHours() * 60 + localEnd.getUTCMinutes();
    if (startMinutes < 8 * 60 || endMinutes > 22 * 60) {
      throw new AppError(400, 'OUTSIDE_OPENING_HOURS', 'A sala funciona das 08h às 22h no horário de Recife.');
    }
  }

  private async ensureRoomAvailable(
    roomId: number,
    userId: number,
    startAt: Date,
    endAt: Date,
    excludeId?: number
  ): Promise<void> {
    const room = await this.roomRepo.findById(roomId);
    if (!room) {
      throw new AppError(404, 'ROOM_NOT_FOUND', 'Sala não encontrada.');
    }
    if (!room.active) {
      throw new AppError(409, 'ROOM_INACTIVE', 'A sala está inativa.');
    }
    if (await this.repo.findRoomConflict(roomId, startAt, endAt, excludeId)) {
      throw new AppError(409, 'ROOM_BOOKING_CONFLICT', 'A sala já possui reserva nesse intervalo.');
    }
    if (await this.repo.findUserConflict(userId, startAt, endAt, excludeId)) {
      throw new AppError(409, 'USER_BOOKING_CONFLICT', 'O usuário já possui reserva nesse intervalo.');
    }
  }

  private async saveOrConflict(save: () => Promise<Booking>): Promise<Booking> {
    try {
      return await save();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'ROOM_BOOKING_CONFLICT', 'A sala já possui reserva com esse início.');
      }
      throw error;
    }
  }
}
