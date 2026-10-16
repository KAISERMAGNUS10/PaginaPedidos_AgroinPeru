import { NotificacionRepository } from '../repositories/notificacion.repository';
import { UsuarioRepository } from '../repositories/usuario.repository';
import { aIso } from '../utils/fechas';

const repo = new NotificacionRepository();
const repoUsuario = new UsuarioRepository();

export class NotificacionService {
  /** Misma forma que `Notificacion` del frontend. */
  async listar(idUsuario: number) {
    const [filas, usuario] = await Promise.all([repo.deUsuario(idUsuario), repoUsuario.porId(idUsuario)]);

    return filas.map(n => ({
      id: `N-${n.id_notificacion}`,
      idNotificacion: n.id_notificacion,
      fecha: aIso(n.fecha_envio),
      leida: Boolean(n.leido),
      mostradoToast: Boolean(n.mostrado_toast),
      ticketId: n.codigo_ticket ?? '',
      correo: usuario?.email ?? '',
      cliente: usuario ? `${usuario.nombres} ${usuario.apellidos}` : '',
      titulo: n.titulo,
      mensaje: n.mensaje,
      tipo: n.tipo
    }));
  }

  async marcarLeidas(idUsuario: number, id?: number) {
    return { actualizadas: await repo.marcarLeidas(idUsuario, id) };
  }

  async marcarToastMostrado(idUsuario: number) {
    await repo.marcarToastMostrado(idUsuario);
    return { ok: true };
  }
}
