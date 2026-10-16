import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api, mensajeError } from '../../../core/utils/api';
import { AgroUI } from '../../../core/utils/agro-ui';
import { AuthService } from '../../../core/services/auth.service';
import { Confirmacion } from '../../../shared/confirmacion';
import { Encabezado } from '../../../shared/encabezado';
import { fechaHora, inicial } from '../../../shared/formato';
import { Icono } from '../../../shared/icono';
import { Modal } from '../../../shared/modal';

interface UsuarioFila {
  id: number;
  Nombre: string;
  Apellidos: string;
  Correo: string;
  Rol: 'ADMIN' | 'CAJA' | 'PICKING' | 'SOPORTE' | 'CLIENTE';
  Telefono: string;
  DocumentoTipo: string;
  DocumentoNumero: string;
  estado: 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';
  fechaRegistro: string;
  ultimoAcceso: string | null;
}

const ROLES = [
  { v: 'ADMIN', t: 'Administrador', clase: 'ap-b-violeta' },
  { v: 'CAJA', t: 'Cajero', clase: 'ap-b-azul' },
  { v: 'PICKING', t: 'Almacenero', clase: 'ap-b-ambar' },
  { v: 'SOPORTE', t: 'Soporte', clase: 'ap-b-verde' },
  { v: 'CLIENTE', t: 'Cliente', clase: 'ap-b-gris' }
];

@Component({
  selector: 'app-usuarios',
  imports: [FormsModule, Encabezado, Icono, Modal],
  templateUrl: './usuarios.html'
})
export class Usuarios {
  private confirmacion = inject(Confirmacion);
  private auth = inject(AuthService);

  protected roles = ROLES;
  protected fechaHora = fechaHora;
  protected inicial = inicial;

  protected cargando = signal(true);
  protected error = signal('');
  protected lista = signal<UsuarioFila[]>([]);
  protected filtroRol = signal('');
  protected busqueda = signal('');

  protected modalAbierto = signal(false);
  protected guardando = signal(false);
  protected errorForm = signal('');
  protected editandoId = signal<number | null>(null);
  protected miId = signal<number | null>(null);

  protected form = this.formVacio();

  protected visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const rol = this.filtroRol();
    return this.lista().filter(u =>
      (!rol || u.Rol === rol) &&
      (!q || `${u.Nombre} ${u.Apellidos} ${u.Correo} ${u.DocumentoNumero}`.toLowerCase().includes(q))
    );
  });

  protected conteo = computed(() => {
    const c: Record<string, number> = { '': this.lista().length };
    ROLES.forEach(r => (c[r.v] = this.lista().filter(u => u.Rol === r.v).length));
    return c;
  });

  constructor() {
    afterNextRender(() => {
      this.miId.set(this.auth.sesion()?.id ?? null);
      this.cargar();
    });
  }

  private formVacio() {
    return {
      rol: 'CAJA', nombre: '', apellidos: '', correo: '', documentoTipo: 'DNI',
      documentoNumero: '', celular: '', password: '', estado: 'ACTIVO'
    };
  }

  protected rolInfo(rol: string) {
    return ROLES.find(r => r.v === rol) ?? ROLES[ROLES.length - 1];
  }

  protected claseEstado(e: string): string {
    return e === 'ACTIVO' ? 'ap-b-verde' : e === 'BLOQUEADO' ? 'ap-b-rojo' : 'ap-b-gris';
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.lista.set(await api.get<UsuarioFila[]>('/usuarios'));
      this.error.set('');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected nuevo(): void {
    this.form = this.formVacio();
    this.editandoId.set(null);
    this.errorForm.set('');
    this.modalAbierto.set(true);
  }

  protected editar(u: UsuarioFila): void {
    this.form = {
      rol: u.Rol, nombre: u.Nombre, apellidos: u.Apellidos, correo: u.Correo,
      documentoTipo: u.DocumentoTipo, documentoNumero: u.DocumentoNumero,
      celular: (u.Telefono ?? '').replace('+51', ''), password: '', estado: u.estado
    };
    this.editandoId.set(u.id);
    this.errorForm.set('');
    this.modalAbierto.set(true);
  }

  protected async guardar(): Promise<void> {
    this.errorForm.set('');
    this.guardando.set(true);
    const f = this.form;

    try {
      if (this.editandoId() === null) {
        await api.post('/usuarios', {
          rol: f.rol, nombre: f.nombre, apellidos: f.apellidos, correo: f.correo,
          documentoTipo: f.documentoTipo, documentoNumero: f.documentoNumero,
          celular: f.celular, password: f.password
        });
        AgroUI.toast('Usuario creado correctamente.', 'success');
      } else {
        const cuerpo: Record<string, unknown> = {
          rol: f.rol, nombre: f.nombre, apellidos: f.apellidos, correo: f.correo,
          celular: f.celular, estado: f.estado
        };
        if (f.password) cuerpo['password'] = f.password;
        await api.put(`/usuarios/${this.editandoId()}`, cuerpo);
        AgroUI.toast('Usuario actualizado.', 'success');
      }
      this.modalAbierto.set(false);
      await this.cargar();
    } catch (e) {
      this.errorForm.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async alternarEstado(u: UsuarioFila): Promise<void> {
    const bloquear = u.estado === 'ACTIVO';
    const ok = await this.confirmacion.preguntar(
      bloquear
        ? `${u.Nombre} ${u.Apellidos} ya no podrá iniciar sesión hasta que lo reactives.`
        : `${u.Nombre} ${u.Apellidos} volverá a poder iniciar sesión.`,
      { titulo: bloquear ? 'Bloquear usuario' : 'Reactivar usuario', textoOk: bloquear ? 'Bloquear' : 'Reactivar', peligro: bloquear }
    );
    if (!ok) return;

    try {
      await api.patch(`/usuarios/${u.id}/estado`, { estado: bloquear ? 'BLOQUEADO' : 'ACTIVO' });
      AgroUI.toast(bloquear ? 'Usuario bloqueado.' : 'Usuario reactivado.', 'success');
      await this.cargar();
    } catch (e) {
      AgroUI.toast(mensajeError(e), 'error');
    }
  }
}
