import { Request, Response } from 'express';

import { ReporteService } from '../services/reporte.service';
import { ok } from '../utils/respuestas';

const servicio = new ReporteService();

export async function generar(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.generar(req.query.desde as string, req.query.hasta as string));
}
