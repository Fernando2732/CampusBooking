import type { Booking } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { CreateBooking, UpdateBooking } from '../../shared/types.js';
import { BookingRepository } from '../repositories/booking.repository.js';
import { RoomRepository } from '../repositories/room.repository.js';
import { AppError } from '../../shared/errors/AppError.js';

export class BookingService {
  private repo = new BookingRepository();
  private roomRepo = new RoomRepository();

  async create(data: CreateBooking): Promise<Booking> {
    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    if (endAt.getTime() <= startAt.getTime()) {
      throw new AppError(400, 'INVALID_BOOKING_INTERVAL', 'O término deve ser posterior ao início.');
    }
    if (startAt.getTime() <= Date.now()) {
      throw new AppError(400, 'BOOKING_START_NOT_FUTURE', 'O início da reserva deve estar no futuro.');
    }
    if (endAt.getTime() - startAt.getTime() > 2 * 60 * 60 * 1000) {
      throw new AppError(400, 'BOOKING_TOO_LONG', 'A reserva pode durar no máximo duas horas.');
    }

    // Recife é UTC-03 no contrato; a validação independe do offset recebido.
    const localStart = new Date(startAt.getTime() - 3 * 60 * 60 * 1000);
    const localEnd = new Date(endAt.getTime() - 3 * 60 * 60 * 1000);
    if (localStart.toISOString().slice(0, 10) !== localEnd.toISOString().slice(0, 10)) {
      throw new AppError(400, 'BOOKING_CROSSES_DAYS', 'A reserva não pode atravessar dias em Recife.');
    }
    const startMinutes = localStart.getUTCHours() * 60 + localStart.getUTCMinutes();
    const endMinutes = localEnd.getUTCHours() * 60 + localEnd.getUTCMinutes();
    if (startMinutes < 8 * 60 || endMinutes > 22 * 60) {
      throw new AppError(400, 'OUTSIDE_OPENING_HOURS', 'A sala funciona das 08h às 22h no horário de Recife.');
    }

    const user = await this.repo.findUser(data.userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
    }
    const room = await this.roomRepo.findById(data.roomId);
    if (!room) {
      throw new AppError(404, 'ROOM_NOT_FOUND', 'Sala não encontrada.');
    }
    if (!room.active) {
      throw new AppError(409, 'ROOM_INACTIVE', 'A sala está inativa.');
    }
    if (await this.repo.findRoomConflict(data.roomId, startAt, endAt)) {
      throw new AppError(409, 'ROOM_BOOKING_CONFLICT', 'A sala já possui reserva nesse intervalo.');
    }
    if (await this.repo.findUserConflict(data.userId, startAt, endAt)) {
      throw new AppError(409, 'USER_BOOKING_CONFLICT', 'O usuário já possui reserva nesse intervalo.');
    }

    try {
      return await this.repo.create({ ...data, startAt, endAt });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'ROOM_BOOKING_CONFLICT', 'A sala já possui reserva com esse início.');
      }
      throw error;
    }
  }

  async update(id: number, data: UpdateBooking): Promise<Booking> {
    // TODO: implementar a funcionalidade e as regras de negócio aplicáveis.
    throw new AppError(
      501,
      'NOT_IMPLEMENTED',
      'Funcionalidade ainda não implementada.'
    );
  }

  async delete(id: number): Promise<void> {
    // TODO: implementar a funcionalidade e as regras de negócio aplicáveis.
    throw new AppError(
      501,
      'NOT_IMPLEMENTED',
      'Funcionalidade ainda não implementada.'
    );
  }
}
