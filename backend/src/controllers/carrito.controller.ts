import { Request, Response } from 'express';

import { CarritoService } from '../services/carrito.service';
import { ok } from '../utils/respuestas';

const servicio = new CarritoService();

export async function obtener(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.obtener(req.auth!.id));
}

export async function agregar(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.agregar(req.auth!.id, req.body), 'Producto agregado al carrito', 201);
}

export async function fijarCantidad(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.fijarCantidad(req.auth!.id, String(req.params.sku), req.body?.cantidad ?? req.body?.qty));
}

export async function quitar(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.quitar(req.auth!.id, String(req.params.sku)), 'Producto eliminado');
}

export async function vaciar(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.vaciar(req.auth!.id), 'Carrito vaciado');
}

export async function reemplazar(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.reemplazar(req.auth!.id, req.body), 'Carrito sincronizado');
}
