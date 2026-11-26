import { z } from 'zod';

const idSchema = z.number().int().positive().max(2147483647);

const bookingDateSchema = z.string()
  .datetime({ offset: true, message: 'Informe um horário ISO 8601 válido com offset explícito.' })
  .refine(value =>
    Number.isFinite(Date.parse(value)) &&
    /T\d{2}:\d{2}:00(?:\.0+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(value) &&
    Date.parse(value) % 60000 === 0,
  'O horário deve ter precisão de minutos, com segundos e milissegundos iguais a zero.');

export const createBookingSchema = z.object({
  userId: idSchema,
  roomId: idSchema,
  startAt: bookingDateSchema,
  endAt: bookingDateSchema,
  purpose: z.string().trim().min(1).max(200)
}).strict();
