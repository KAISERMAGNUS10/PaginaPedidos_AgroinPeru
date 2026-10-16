import { Request, Response } from 'express';

import { ProductoService } from '../services/producto.service';
import { ok } from '../utils/respuestas';

const servicio = new ProductoService();

export async function listarProductos(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.listar(req.query));
}

export async function detalleProducto(req: Request, res: Response): Promise<void> {
  ok(res, await servicio.detalle(String(req.params.sku)));
}

export async function listarCategorias(_req: Request, res: Response): Promise<void> {
  ok(res, await servicio.categorias());
}

export async function listarTiendas(_req: Request, res: Response): Promise<void> {
  ok(res, await servicio.tiendas());
}
