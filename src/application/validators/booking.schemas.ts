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

export const updateBookingSchema = createBookingSchema
  .omit({ userId: true })
  .partial()
  .strict()
  .refine(data => Object.keys(data).length > 0, 'Informe pelo menos um campo para alterar.');

export const bookingParamsSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'Informe um ID de reserva inteiro positivo.')
    .transform(Number)
    .pipe(idSchema)
});
