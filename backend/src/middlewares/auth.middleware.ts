import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { AuthPayload, RolUsuario } from '../models/auth.model';
import { noAutorizado, prohibido } from '../utils/errores';

export function verificarToken(req: Request, _res: Response, next: NextFunction): void {
  const authorization = req.headers.authorization;

  if (!authorization) {
    throw noAutorizado('TOKEN_REQUERIDO', 'Token de autenticación requerido');
  }

  const partes = authorization.split(' ');

  if (partes.length !== 2 || partes[0] !== 'Bearer') {
    throw noAutorizado('TOKEN_FORMATO_INVALIDO', 'Formato de token inválido');
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET no configurado');
  }

  try {
    req.auth = jwt.verify(partes[1], secret) as AuthPayload;
  } catch {
    throw noAutorizado('TOKEN_INVALIDO', 'Token inválido o expirado');
  }

  next();
}

/**
 * Permite el paso a los roles indicados. ADMIN entra siempre
 * (igual que en el frontend: ADMIN accede a todos los módulos).
 */
export function requerirRol(...roles: RolUsuario[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const rol = req.auth?.rol;

    if (!rol || (rol !== 'ADMIN' && !roles.includes(rol))) {
      throw prohibido('ROL_NO_PERMITIDO', 'No tienes permiso para esta acción');
    }

    next();
  };
}

export const soloAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.auth?.rol !== 'ADMIN') {
    throw prohibido('SOLO_ADMIN', 'Acceso permitido solo para administradores');
  }
  next();
};

export const soloClientes = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.auth?.rol !== 'CLIENTE') {
    throw prohibido('SOLO_CLIENTES', 'Acceso permitido solo para clientes');
  }
  next();
};
