import { z } from 'zod';

export const buildingParamsSchema = z.object({
  buildingId: z.string()
    .regex(/^\d+$/, 'Informe um ID de prédio inteiro positivo.')
    .transform(Number)
    .pipe(z.number().int().positive().max(2147483647))
});

export const buildingUsageQuerySchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data no formato YYYY-MM-DD.')
    .refine(value => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, 'Informe uma data real no formato YYYY-MM-DD.')
});
