import { Response } from 'express';

export function ok<T>(
  res: Response,
  data: T,
  message = 'OK',
  status = 200
): void {
  res.status(status).json({ success: true, message, data });
}
