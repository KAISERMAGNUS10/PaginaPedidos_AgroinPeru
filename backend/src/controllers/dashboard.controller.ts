import { Request, Response } from 'express';

import { DashboardService } from '../services/dashboard.service';
import { ok } from '../utils/respuestas';

const servicio = new DashboardService();

export async function resumen(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.resumen(req.query.desde as string, req.query.hasta as string));
}

export async function reiniciarDemo(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.reiniciarDemo(req.body?.confirmar), 'Datos operativos reiniciados');
}
