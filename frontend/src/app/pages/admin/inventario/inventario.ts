import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api, mensajeError } from '../../../core/utils/api';
import { AgroUI } from '../../../core/utils/agro-ui';
import { Encabezado } from '../../../shared/encabezado';
import { descargarCsv, fechaHora, numero, soles, solesCorto } from '../../../shared/formato';
import { Icono } from '../../../shared/icono';
import { Modal } from '../../../shared/modal';

interface ProductoInv {
  id: string;
  nombre: string;
  nombreBase: string;
  categoria: string;
  subcategoria: string;
  medida: string;
  cantidadCaja: number | null;
  cantidadBolsa: number | null;
  precio: number;
  imagen: string;
  descripcion: string;
  stockTienda: number;
  stockAlmacen: number;
  stockTotal: number;
  stockMinimo: number;
  estado: 'DISPONIBLE' | 'AGOTADO' | 'DESCONTINUADO';
}

interface Movimiento {
  id_movimiento: number;
  codigo_sku: string;
  nombre_completo: string;
  usuario: string;
  codigo_ticket: string | null;
  tipo_movimiento: string;
  ubicacion_origen: string | null;
  ubicacion_destino: string | null;
  cantidad: number;
  stock_anterior: number;
  stock_posterior: number;
  motivo: string | null;
  fecha_movimiento: string;
}

const POR_PAGINA = 20;

@Component({
  selector: 'app-inventario',
  imports: [FormsModule, Encabezado, Icono, Modal],
  templateUrl: './inventario.html'
})
export class Inventario {
  protected soles = soles;
  protected solesCorto = solesCorto;
  protected numero = numero;
  protected fechaHora = fechaHora;

  protected cargando = signal(true);
  protected error = signal('');
  protected lista = signal<ProductoInv[]>([]);

  protected busqueda = signal('');
  protected categoria = signal('');
  protected filtroStock = signal<'' | 'bajo' | 'sin' | 'oculto'>('');
  protected pagina = signal(1);

  // --- modal producto ---
  protected modalProducto = signal(false);
  protected editandoSku = signal<string | null>(null);
  protected errorProducto = signal('');
  protected guardando = signal(false);
  protected fp = this.productoVacio();

  // --- modal movimiento ---
  protected modalMov = signal(false);
  protected movProducto = signal<ProductoInv | null>(null);
  protected errorMov = signal('');
  protected fm = { tipo: 'ENTRADA', ubicacion: 'ALMACEN', origen: 'ALMACEN', destino: 'TIENDA', cantidad: 1, motivo: '' };

  // --- modal kardex ---
  protected modalKardex = signal(false);
  protected kardex = signal<Movimiento[]>([]);
  protected kardexCargando = signal(false);
  protected kardexTitulo = signal('Kardex de movimientos');
  protected kardexTipo = signal('');
  private kardexSku = '';

  protected categorias = computed(() => [...new Set(this.lista().map(p => p.categoria))].sort((a, b) => a.localeCompare(b, 'es')));

  protected kpis = computed(() => {
    const l = this.lista().filter(p => p.estado !== 'DESCONTINUADO');
    return {
      productos: l.length,
      unidades: l.reduce((a, p) => a + p.stockTotal, 0),
      valor: l.reduce((a, p) => a + p.stockTotal * p.precio, 0),
      bajo: l.filter(p => p.stockTotal > 0 && p.stockTotal <= p.stockMinimo).length,
      sin: l.filter(p => p.stockTotal === 0).length
    };
  });

  protected filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const cat = this.categoria();
    const fs = this.filtroStock();
    return this.lista().filter(p => {
      if (fs === 'oculto') { if (p.estado !== 'DESCONTINUADO') return false; }
      else if (p.estado === 'DESCONTINUADO' && fs === '') return false;
      if (fs === 'bajo' && !(p.stockTotal > 0 && p.stockTotal <= p.stockMinimo)) return false;
      if (fs === 'sin' && p.stockTotal !== 0) return false;
      if (cat && p.categoria !== cat) return false;
      return !q || `${p.nombre} ${p.id} ${p.categoria}`.toLowerCase().includes(q);
    });
  });

  protected totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / POR_PAGINA)));
  protected visibles = computed(() => {
    const p = Math.min(this.pagina(), this.totalPaginas());
    return this.filtrados().slice((p - 1) * POR_PAGINA, p * POR_PAGINA);
  });
  protected paginaReal = computed(() => Math.min(this.pagina(), this.totalPaginas()));

  constructor() {
    afterNextRender(() => this.cargar());
  }

  private productoVacio() {
    return {
      id: '', nombre: '', nombreCompleto: '', categoria: '', subcategoria: '', medida: '',
      cantidadCaja: '' as number | string, cantidadBolsa: '' as number | string, precio: 0,
      stockTienda: 0, stockAlmacen: 0, stockMinimo: 10, imagen: '', descripcion: '', estado: 'DISPONIBLE'
    };
  }

  protected filtroCambio(): void {
    this.pagina.set(1);
  }

  protected claseStock(p: ProductoInv): string {
    if (p.stockTotal === 0) return 'ap-b-rojo';
    return p.stockTotal <= p.stockMinimo ? 'ap-b-ambar' : 'ap-b-verde';
  }

  protected claseEstado(e: string): string {
    return e === 'DISPONIBLE' ? 'ap-b-verde' : e === 'AGOTADO' ? 'ap-b-ambar' : 'ap-b-gris';
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.lista.set(await api.get<ProductoInv[]>('/inventario'));
      this.error.set('');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  // ---------------------------------------------------------------- producto
  protected nuevoProducto(): void {
    this.fp = this.productoVacio();
    this.editandoSku.set(null);
    this.errorProducto.set('');
    this.modalProducto.set(true);
  }

  protected editarProducto(p: ProductoInv): void {
    this.fp = {
      id: p.id, nombre: p.nombreBase, nombreCompleto: p.nombre, categoria: p.categoria,
      subcategoria: p.subcategoria, medida: p.medida, cantidadCaja: p.cantidadCaja ?? '',
      cantidadBolsa: p.cantidadBolsa ?? '', precio: p.precio, stockTienda: p.stockTienda,
      stockAlmacen: p.stockAlmacen, stockMinimo: p.stockMinimo, imagen: p.imagen,
      descripcion: p.descripcion, estado: p.estado
    };
    this.editandoSku.set(p.id);
    this.errorProducto.set('');
    this.modalProducto.set(true);
  }

  protected async guardarProducto(): Promise<void> {
    this.errorProducto.set('');
    this.guardando.set(true);
    const f = this.fp;

    try {
      if (this.editandoSku() === null) {
        await api.post('/inventario/productos', {
          id: f.id, nombre: f.nombre, nombreCompleto: f.nombreCompleto || undefined, categoria: f.categoria,
          subcategoria: f.subcategoria, medida: f.medida, cantidadCaja: f.cantidadCaja, cantidadBolsa: f.cantidadBolsa,
          precio: Number(f.precio), stockTienda: Number(f.stockTienda), stockAlmacen: Number(f.stockAlmacen),
          stockMinimo: Number(f.stockMinimo), imagen: f.imagen, descripcion: f.descripcion
        });
        AgroUI.toast('Producto creado.', 'success');
      } else {
        await api.put(`/inventario/productos/${encodeURIComponent(this.editandoSku()!)}`, {
          nombre: f.nombre, nombreCompleto: f.nombreCompleto, categoria: f.categoria, subcategoria: f.subcategoria,
          medida: f.medida, cantidadCaja: f.cantidadCaja, cantidadBolsa: f.cantidadBolsa, precio: Number(f.precio),
          stockMinimo: Number(f.stockMinimo), imagen: f.imagen, descripcion: f.descripcion, estado: f.estado
        });
        AgroUI.toast('Producto actualizado.', 'success');
      }
      this.modalProducto.set(false);
      await this.cargar();
    } catch (e) {
      this.errorProducto.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  // -------------------------------------------------------------- movimiento
  protected abrirMovimiento(p: ProductoInv): void {
    this.movProducto.set(p);
    this.fm = { tipo: 'ENTRADA', ubicacion: 'ALMACEN', origen: 'ALMACEN', destino: 'TIENDA', cantidad: 1, motivo: '' };
    this.errorMov.set('');
    this.modalMov.set(true);
  }

  protected tipoCambio(): void {
    // En un ajuste, la cantidad es el stock FINAL que debe quedar.
    const p = this.movProducto();
    if (this.fm.tipo === 'AJUSTE' && p) {
      this.fm.cantidad = this.fm.ubicacion === 'TIENDA' ? p.stockTienda : p.stockAlmacen;
    } else if (this.fm.tipo !== 'AJUSTE') {
      this.fm.cantidad = 1;
    }
  }

  protected ubicacionCambio(): void {
    if (this.fm.tipo === 'AJUSTE') this.tipoCambio();
  }

  protected async guardarMovimiento(): Promise<void> {
    const p = this.movProducto();
    if (!p) return;
    this.errorMov.set('');
    this.guardando.set(true);

    try {
      await api.post('/inventario/movimientos', {
        sku: p.id, tipo: this.fm.tipo, cantidad: Number(this.fm.cantidad), motivo: this.fm.motivo,
        ubicacion: this.fm.ubicacion, origen: this.fm.origen, destino: this.fm.destino
      });
      AgroUI.toast('Movimiento registrado en el kardex.', 'success');
      this.modalMov.set(false);
      await this.cargar();
    } catch (e) {
      this.errorMov.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  // ------------------------------------------------------------------ kardex
  protected async abrirKardex(p?: ProductoInv): Promise<void> {
    this.kardexSku = p?.id ?? '';
    this.kardexTipo.set('');
    this.kardexTitulo.set(p ? `Kardex · ${p.nombre}` : 'Kardex general (últimos movimientos)');
    this.modalKardex.set(true);
    await this.cargarKardex();
  }

  protected async cargarKardex(): Promise<void> {
    this.kardexCargando.set(true);
    try {
      this.kardex.set(await api.get<Movimiento[]>('/inventario/movimientos', {
        sku: this.kardexSku, tipo: this.kardexTipo(), limite: 200
      }));
    } catch (e) {
      AgroUI.toast(mensajeError(e), 'error');
    } finally {
      this.kardexCargando.set(false);
    }
  }

  protected claseMov(t: string): string {
    return t === 'ENTRADA' ? 'ap-b-verde' : t === 'SALIDA' ? 'ap-b-rojo' : t === 'AJUSTE' ? 'ap-b-ambar' : 'ap-b-azul';
  }

  protected exportar(): void {
    descargarCsv(
      'inventario',
      ['SKU', 'Producto', 'Categoría', 'Precio', 'Stock tienda', 'Stock almacén', 'Stock total', 'Stock mínimo', 'Estado'],
      this.filtrados().map(p => [p.id, p.nombre, p.categoria, p.precio, p.stockTienda, p.stockAlmacen, p.stockTotal, p.stockMinimo, p.estado])
    );
  }

  protected imagenRota(ev: Event): void {
    (ev.target as HTMLImageElement).src = 'img/logoagroperu.jpg';
  }
}
