import { Request, Response } from 'express';

import { NotificacionService } from '../services/notificacion.service';
import { ok } from '../utils/respuestas';

const servicio = new NotificacionService();

export async function listar(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.listar(req.auth!.id));
}

export async function marcarLeidas(req: Request, res: Response): Promise<void> {
  const id = req.params.id ? Number(req.params.id) : undefined;
  ok(res, await servicio.marcarLeidas(req.auth!.id, id && Number.isInteger(id) ? id : undefined));
}

export async function marcarToastMostrado(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.marcarToastMostrado(req.auth!.id));
}
