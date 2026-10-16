import { Routes } from '@angular/router';
import { rolGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  /*
  |--------------------------------------------------------------------------
  | TIENDA / CLIENTE  (public-layout)
  |--------------------------------------------------------------------------
  */
  {
    path: '',
    loadComponent: () => import('./layouts/public-layout/public-layout').then(m => m.PublicLayout),
    children: [
      {
        path: '',
        title: 'AIDP - Agro Integral del Perú',
        loadComponent: () => import('./pages/public/home/home').then(m => m.Home)
      },
      {
        path: 'producto',
        title: 'Detalle de Producto - AIDP',
        loadComponent: () => import('./pages/public/producto/producto').then(m => m.Producto)
      },
      {
        path: 'login',
        title: 'AGROINPERU - Iniciar Sesión',
        loadComponent: () => import('./pages/auth/login/login').then(m => m.Login)
      },
      {
        path: 'registro',
        title: 'AGROINPERU - Regístrate',
        loadComponent: () => import('./pages/auth/registro/registro').then(m => m.Registro)
      },
      {
        path: 'acceso-denegado',
        title: 'AGROINPERU - Acceso no permitido',
        loadComponent: () =>
          import('./pages/auth/acceso-denegado/acceso-denegado').then(m => m.AccesoDenegado)
      },
      {
        path: 'carrito',
        title: 'AGROINPERU - Carro de Compras',
        loadComponent: () => import('./pages/client/carrito/carrito').then(m => m.Carrito)
      },
      {
        path: 'checkout',
        title: 'AGROINPERU - Checkout',
        loadComponent: () => import('./pages/client/checkout/checkout').then(m => m.Checkout)
      },
      {
        path: 'mis-pedidos',
        title: 'AGROINPERU - Mis Pedidos',
        loadComponent: () => import('./pages/client/mis-pedidos/mis-pedidos').then(m => m.MisPedidos)
      },
      {
        path: 'ticket',
        title: 'AGROINPERU - Ticket de Pago',
        loadComponent: () => import('./pages/client/ticket/ticket').then(m => m.Ticket)
      }
    ]
  },

  /*
  |--------------------------------------------------------------------------
  | PANEL INTERNO  (admin-layout)
  |--------------------------------------------------------------------------
  */
  {
    path: 'admin',
    loadComponent: () => import('./layouts/admin-layout/admin-layout').then(m => m.AdminLayout),
    children: [
      {
        path: '',
        title: 'AGROINPERU - Dashboard',
        canActivate: [rolGuard('ADMIN')],
        loadComponent: () => import('./pages/admin/dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'ventas',
        title: 'AGROINPERU - Ventas',
        canActivate: [rolGuard('ADMIN')],
        loadComponent: () => import('./pages/admin/ventas/ventas').then(m => m.Ventas)
      },
      {
        path: 'compras',
        title: 'AGROINPERU - Compras',
        canActivate: [rolGuard('ADMIN')],
        loadComponent: () => import('./pages/admin/compras/compras').then(m => m.Compras)
      },
      {
        path: 'inventario',
        title: 'AGROINPERU - Inventario',
        canActivate: [rolGuard('ADMIN')],
        loadComponent: () => import('./pages/admin/inventario/inventario').then(m => m.Inventario)
      },
      {
        path: 'reportes',
        title: 'AGROINPERU - Reportes',
        canActivate: [rolGuard('ADMIN')],
        loadComponent: () => import('./pages/admin/reportes/reportes').then(m => m.Reportes)
      },
      {
        path: 'usuarios',
        title: 'AGROINPERU - Usuarios',
        canActivate: [rolGuard('ADMIN')],
        loadComponent: () => import('./pages/admin/usuarios/usuarios').then(m => m.Usuarios)
      },
      {
        path: 'caja',
        title: 'AGROINPERU - Caja',
        canActivate: [rolGuard('CAJA')],
        loadComponent: () => import('./pages/admin/caja/caja').then(m => m.Caja)
      },
      {
        path: 'picking',
        title: 'AGROINPERU - Almacén',
        canActivate: [rolGuard('PICKING')],
        loadComponent: () => import('./pages/admin/picking/picking').then(m => m.Picking)
      }
    ]
  },

  { path: '**', redirectTo: '' }
];
