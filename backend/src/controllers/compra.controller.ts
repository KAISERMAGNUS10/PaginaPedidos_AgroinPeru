import { Request, Response } from 'express';

import { CompraService } from '../services/compra.service';
import { ok } from '../utils/respuestas';

const servicio = new CompraService();

export async function listar(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.listar({
    desde: req.query.desde as string,
    hasta: req.query.hasta as string,
    estado: req.query.estado as string,
    q: typeof req.query.q === 'string' ? req.query.q.trim() : undefined
  }));
}
export async function detalle(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.detalle(String(req.params.codigo)));
}
export async function crear(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.crear(req.auth!.id, req.body), 'Compra registrada y stock actualizado', 201);
}
export async function anular(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.anular(req.auth!.id, String(req.params.codigo)), 'Compra anulada y stock revertido');
}
