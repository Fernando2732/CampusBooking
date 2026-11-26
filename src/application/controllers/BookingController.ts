import type { Request, Response } from 'express';
import { BookingService } from '../../infrastructure/services/booking.service.js';
import { bookingParamsSchema, createBookingSchema, updateBookingSchema } from '../validators/booking.schemas.js';

export class BookingController {
  private service = new BookingService();

  create = async (req: Request, res: Response): Promise<void> => {
    const data = createBookingSchema.parse(req.body);
    const booking = await this.service.create(data);
    res.status(201).json(booking);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = bookingParamsSchema.parse(req.params);
    const data = updateBookingSchema.parse(req.body);
    const booking = await this.service.update(id, data);
    res.status(200).json(booking);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const { id } = bookingParamsSchema.parse(req.params);
    await this.service.delete(id);
    res.status(204).send();
  };
}
