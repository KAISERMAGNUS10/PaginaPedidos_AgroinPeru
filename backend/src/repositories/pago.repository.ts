import { PoolConnection, RowDataPacket } from 'mysql2/promise';

export class PagoRepository {
  /** Siguiente número correlativo de la serie (B001 / F001), formato 00000001. */
  async siguienteNumero(conexion: PoolConnection, serie: string): Promise<string> {
    const [rows] = await conexion.query<RowDataPacket[]>(
      `SELECT COALESCE(MAX(CAST(numero_comprobante AS UNSIGNED)), 0) AS ultimo
         FROM tbl_pagos
        WHERE serie_comprobante = ?
        FOR UPDATE`,
      [serie]
    );
    return String(Number(rows[0].ultimo) + 1).padStart(8, '0');
  }

  async registrar(
    conexion: PoolConnection,
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
