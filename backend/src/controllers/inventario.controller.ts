import { Request, Response } from 'express';

import { InventarioService } from '../services/inventario.service';
import { ok } from '../utils/respuestas';

const servicio = new InventarioService();

export async function listarStock(req: Request, res: Response): Promise<void> {
  ok(
    res,
    await servicio.listarStock({
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      bajoMinimo: req.query.bajoMinimo === 'true'
    })
  );
}

export async function movimientos(req: Request, res: Response): Promise<void> {
  ok(
    res,
    await servicio.movimientos({
      sku: typeof req.query.sku === 'string' ? req.query.sku : undefined,
      tipo: typeof req.query.tipo === 'string' ? req.query.tipo.toUpperCase() : undefined,
      limite: Number(req.query.limite)
    })
  );
}

export async function registrarMovimiento(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.registrarMovimiento(req.auth!.id, req.body), 'Movimiento registrado', 201);
}

export async function crearProducto(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.crearProducto(req.auth!.id, req.body), 'Producto creado', 201);
}

export async function actualizarProducto(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.actualizarProducto(String(req.params.sku), req.body), 'Producto actualizado');
}
