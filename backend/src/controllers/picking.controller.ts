import { Request, Response } from 'express';

import { PickingService } from '../services/picking.service';
import { ok } from '../utils/respuestas';

const servicio = new PickingService();

export async function pendientes(_req: Request, res: Response): Promise<void> {
  ok(res, await servicio.pendientes());
}

export async function porEntregar(_req: Request, res: Response): Promise<void> {
  ok(res, await servicio.porEntregar());
}

export async function historial(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.historial(req.query.desde as string, req.query.hasta as string));
}

export async function progreso(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.registrarProgreso(req.auth!.id, String(req.params.codigo), req.body?.items));
}

export async function marcarListo(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.marcarListo(req.auth!.id, String(req.params.codigo)), 'Pedido listo para recojo');
}

export async function entregar(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.entregar(req.auth!.id, String(req.params.codigo)), 'Pedido entregado');
}
