import type { Usage } from '../../shared/types.js';
import { BuildingRepository } from '../repositories/building.repository.js';
import { AppError } from '../../shared/errors/AppError.js';

export class BuildingService {
  private repo = new BuildingRepository();

  async usage(buildingId: number, date: string): Promise<Usage> {
    const building = await this.repo.findById(buildingId);
    if (!building) {
      throw new AppError(404, 'BUILDING_NOT_FOUND', 'Prédio não encontrado.');
    }

    // Recife é UTC-03 conforme o contrato, independentemente do fuso do servidor.
    const from = new Date(`${date}T00:00:00-03:00`);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    const roomsWithBookings = await this.repo.roomsWithBookings(buildingId, from, to);
    const dailyMinutes = 840;
    const percentage = (booked: number, total: number): number =>
      total === 0 ? 0 : Number((booked / total * 100).toFixed(2));

    const rooms = roomsWithBookings.map(room => {
      const bookedMinutes = room.bookings.reduce((total, booking) => {
        if (!booking.endAt) {
          throw new AppError(500, 'INVALID_BOOKING_DATA', 'Reserva sem horário de término definido.');
        }
        return total + (booking.endAt.getTime() - booking.startAt.getTime()) / 60000;
      }, 0);

      return {
        roomId: room.id,
        name: room.name,
        bookings: room.bookings.length,
        bookedMinutes,
        availableMinutes: dailyMinutes - bookedMinutes,
        usagePercentage: percentage(bookedMinutes, dailyMinutes)
      };
    });
    rooms.sort((a, b) => b.usagePercentage - a.usagePercentage || a.roomId - b.roomId);

    const totalAvailableMinutes = rooms.length * dailyMinutes;
    const totalBookedMinutes = rooms.reduce((total, room) => total + room.bookedMinutes, 0);

    return {
      buildingId: building.id,
      buildingName: building.name,
      date,
      totalRooms: rooms.length,
      totalBookings: rooms.reduce((total, room) => total + room.bookings, 0),
      totalAvailableMinutes,
      totalBookedMinutes,
      overallUsagePercentage: percentage(totalBookedMinutes, totalAvailableMinutes),
      rooms
    };
  }
}
