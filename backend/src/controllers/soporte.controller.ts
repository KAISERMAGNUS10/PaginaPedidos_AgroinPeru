import { Request, Response } from 'express';

import { SoporteService } from '../services/soporte.service';
import { ok } from '../utils/respuestas';

const servicio = new SoporteService();

export async function listar(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.listar(typeof req.query.estado === 'string' ? req.query.estado : undefined));
}

export async function restablecer(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.restablecer(req.auth!.id, Number(req.params.id)), 'Contraseña temporal asignada');
}

export async function rechazar(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.rechazar(req.auth!.id, Number(req.params.id), req.body), 'Solicitud rechazada');
}
