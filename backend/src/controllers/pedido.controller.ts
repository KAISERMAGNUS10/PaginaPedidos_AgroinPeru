import { Request, Response } from 'express';

import { PedidoService } from '../services/pedido.service';
import { ok } from '../utils/respuestas';

const servicio = new PedidoService();

export async function crear(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.crear(req.auth!.id, req.body), 'Pedido generado correctamente', 201);
}

export async function misPedidos(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.misPedidos(req.auth!.id));
}

export async function obtener(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.obtener(String(req.params.codigo), req.auth!));
}

export async function cancelar(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.cancelar(req.auth!.id, String(req.params.codigo)), 'Pedido cancelado');
}

export async function fijarPersona(req: Request, res: Response): Promise<void> {
  ok(
    res,
    await servicio.fijarPersonaAutorizada(req.auth!.id, String(req.params.codigo), req.body),
    'Persona autorizada guardada'
  );
}

export async function quitarPersona(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.quitarPersonaAutorizada(req.auth!.id, String(req.params.codigo)), 'Persona autorizada eliminada');
}
