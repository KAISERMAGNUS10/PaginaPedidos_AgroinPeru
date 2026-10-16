import { NextFunction, Request, Response } from 'express';

import { AppError } from '../utils/errores';

export function manejarErrorGlobal(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    res.status(error.status).json({
      success: false,
      code: error.codigo,
      message: error.message
    });
    return;
  }

  if (error instanceof Error && error.message === 'ORIGEN_NO_PERMITIDO') {
    res.status(403).json({
      success: false,
      code: 'ORIGEN_NO_PERMITIDO',
      message: 'Origen no permitido'
    });
    return;
  }

  // JSON mal formado en el body
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      success: false,
      code: 'JSON_INVALIDO',
      message: 'JSON inválido'
    });
    return;
  }

  console.error('Error no controlado:', error);

  res.status(500).json({
    success: false,
    code: 'ERROR_INTERNO',
    message: 'Error interno del servidor'
  });
}
