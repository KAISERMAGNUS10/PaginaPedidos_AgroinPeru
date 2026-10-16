import { Conexion, Fila } from '../config/database';

export class PagoRepository {
  /** Siguiente número correlativo de la serie (B001 / F001), formato 00000001. */
  async siguienteNumero(conexion: Conexion, serie: string): Promise<string> {
    // Bloquea la serie hasta el fin de la transacción para que dos cobros no tomen el mismo número.
    await conexion.query('SELECT pg_advisory_xact_lock(hashtext(?))', [`comprobante-${serie}`]);

    const [rows] = await conexion.query<Fila[]>(
      `SELECT COALESCE(MAX(CAST(numero_comprobante AS INTEGER)), 0) AS ultimo
         FROM tbl_pagos
        WHERE serie_comprobante = ?`,
      [serie]
    );
    return String(Number(rows[0].ultimo) + 1).padStart(8, '0');
  }

  async registrar(
    conexion: Conexion,
    datos: {
      id_pedido: number;
      id_cajero: number;
      metodo_pago: string;
      monto_total: number;
      monto_recibido: number;
      vuelto_entregado: number;
      numero_operacion: string | null;
      serie_comprobante: string;
      numero_comprobante: string;
    }
  ): Promise<void> {
    await conexion.execute(
      `INSERT INTO tbl_pagos
         (id_pedido, id_cajero, metodo_pago, monto_total, monto_recibido,
          vuelto_entregado, numero_operacion, serie_comprobante, numero_comprobante, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETADO')`,
      [
        datos.id_pedido,
        datos.id_cajero,
        datos.metodo_pago,
        datos.monto_total,
        datos.monto_recibido,
        datos.vuelto_entregado,
        datos.numero_operacion,
        datos.serie_comprobante,
        datos.numero_comprobante
      ]
    );
  }
}
