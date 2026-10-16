import { Request, Response } from 'express';

import { AuthService } from '../services/auth.service';
import { ok } from '../utils/respuestas';

const servicio = new AuthService();

export async function login(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.login(req.body), 'Inicio de sesión correcto');
}

export async function registro(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.registrarCliente(req.body), 'Cuenta creada correctamente', 201);
}

export async function perfil(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.perfil(req.auth!.id));
}

export async function cambiarPassword(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.cambiarPassword(req.auth!.id, req.body), 'Contraseña actualizada');
}

export async function solicitarRecuperacion(req: Request, res: Response): Promise<void> {
  ok(
    res,
    await servicio.solicitarRecuperacion(req.body),
    'Si los datos coinciden con una cuenta, soporte atenderá tu solicitud.',
    201
  );
}
