import type { Request, Response } from 'express';
import { BuildingService } from '../../infrastructure/services/building.service.js';
import { buildingParamsSchema, buildingUsageQuerySchema } from '../validators/building.schemas.js';

export class BuildingController {
  private service = new BuildingService();

  usage = async (req: Request, res: Response): Promise<void> => {
    const { buildingId } = buildingParamsSchema.parse(req.params);
    const { date } = buildingUsageQuerySchema.parse(req.query);
    const usage = await this.service.usage(buildingId, date);
    res.status(200).json(usage);
  };
}
