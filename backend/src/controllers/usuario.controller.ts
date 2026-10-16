import { Request, Response } from 'express';

import { badRequest } from '../utils/errores';
import { UsuarioService } from '../services/usuario.service';
import { ok } from '../utils/respuestas';

const servicio = new UsuarioService();

export async function listar(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.listar(typeof req.query.rol === 'string' ? req.query.rol : undefined));
}

export async function crearPersonal(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.crearPersonal(req.body), 'Usuario creado', 201);
}

export async function cambiarEstado(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw badRequest('ID_INVALIDO', 'Id de usuario inválido.');

  ok(res, await servicio.cambiarEstado(id, req.body?.estado, req.auth!.id), 'Estado actualizado');
}

export async function actualizar(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw badRequest('ID_INVALIDO', 'Id de usuario inválido.');

  ok(res, await servicio.actualizar(id, req.body, req.auth!.id), 'Usuario actualizado');
}
