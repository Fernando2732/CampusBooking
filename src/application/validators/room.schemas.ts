import { RoomType } from '@prisma/client';
import { z } from 'zod';

const positiveIntegerQuery = z.string()
  .regex(/^\d+$/, 'Informe um inteiro positivo.')
  .transform(Number)
  .pipe(z.number().int().positive().safe());

export const roomFiltersSchema = z.object({
  buildingId: positiveIntegerQuery.pipe(z.number().max(2147483647)).optional(),
  type: z.nativeEnum(RoomType).optional(),
  minCapacity: positiveIntegerQuery.optional(),
  active: z.enum(['true', 'false']).transform(value => value === 'true').optional(),
  name: z.string().trim().min(1, 'Informe um nome não vazio.').optional()
});
