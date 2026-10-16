import { Request, Response } from 'express';

import { CajaService } from '../services/caja.service';
import { ok } from '../utils/respuestas';

const servicio = new CajaService();

export async function buscar(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.buscar(req.query.q));
}

export async function pagar(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.pagar(req.auth!.id, String(req.params.codigo), req.body), 'Pago registrado correctamente');
}

export async function ventas(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.ventas(req.query.desde as string, req.query.hasta as string));
}

export async function detalleVenta(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.detalleVenta(String(req.params.codigo)));
}

export async function pendientes(_req: Request, res: Response): Promise<void> {
  ok(res, await servicio.pendientes());
}
