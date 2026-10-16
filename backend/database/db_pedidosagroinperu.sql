-- =====================================================
-- Base de datos: db_pedidosagroinperu  (SCRIPT COMPLETO)
-- Instrucciones: abrir en MySQL Workbench, ejecutar todo
-- (Ctrl + Shift + Enter) y refrescar la lista de esquemas.
-- Incluye: tablas originales + carrito + movimientos de inventario
-- =====================================================

CREATE DATABASE IF NOT EXISTS db_pedidosagroinperu
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE db_pedidosagroinperu;

-- -----------------------------------------------------
-- Tabla: tbl_roles
-- -----------------------------------------------------
CREATE TABLE tbl_roles (
  id_rol INT NOT NULL AUTO_INCREMENT,
  nombre_rol VARCHAR(50) NOT NULL,
  descripcion VARCHAR(255) DEFAULT NULL,
  estado VARCHAR(20) DEFAULT 'ACTIVO' COMMENT 'ACTIVO / INACTIVO',
  fecha_creacion TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_rol),
  UNIQUE KEY nombre_rol (nombre_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Roles de seguridad del sistema';

-- -----------------------------------------------------
-- Tabla: tbl_usuarios
-- -----------------------------------------------------
CREATE TABLE tbl_usuarios (
  id_usuario INT NOT NULL AUTO_INCREMENT,
  id_rol INT NOT NULL,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  tipo_documento VARCHAR(20) NOT NULL DEFAULT 'DNI' COMMENT 'DNI / CE / RUC / PASAPORTE',
  numero_documento VARCHAR(20) NOT NULL,
  email VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  telefono VARCHAR(20) NOT NULL,
  direccion VARCHAR(255) DEFAULT NULL,
  estado VARCHAR(20) DEFAULT 'ACTIVO' COMMENT 'ACTIVO / INACTIVO / BLOQUEADO',
  fecha_registro TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso DATETIME DEFAULT NULL,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY numero_documento (numero_documento),
  UNIQUE KEY email (email),
  KEY fk_usuarios_rol (id_rol),
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (id_rol)
    REFERENCES tbl_roles (id_rol) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Usuarios registrados en la plataforma';

-- -----------------------------------------------------
-- Tabla: tbl_categorias
-- -----------------------------------------------------
CREATE TABLE tbl_categorias (
  id_categoria INT NOT NULL AUTO_INCREMENT,
  codigo_categoria VARCHAR(50) NOT NULL,
  nombre_categoria VARCHAR(100) NOT NULL,
  descripcion TEXT,
  estado VARCHAR(20) DEFAULT 'ACTIVO' COMMENT 'ACTIVO / INACTIVO',
  fecha_creacion TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_categoria),
  UNIQUE KEY codigo_categoria (codigo_categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Categorías del catálogo de productos';

-- -----------------------------------------------------
-- Tabla: tbl_productos
-- -----------------------------------------------------
CREATE TABLE tbl_productos (
  id_producto INT NOT NULL AUTO_INCREMENT,
  codigo_sku VARCHAR(80) NOT NULL,
  id_categoria INT NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  nombre_completo VARCHAR(255) NOT NULL,
  subcategoria VARCHAR(100) DEFAULT NULL,
  medida VARCHAR(50) DEFAULT NULL,
  cantidad_caja INT DEFAULT 0,
  cantidad_bolsa INT DEFAULT 0,
  precio DECIMAL(10,2) NOT NULL,
  stock_tienda INT NOT NULL DEFAULT 50,
  stock_almacen INT NOT NULL DEFAULT 200,
  stock_minimo INT NOT NULL DEFAULT 10,
  imagen_url VARCHAR(255) DEFAULT NULL,
  descripcion TEXT,
  descripcion_fotografica TEXT,
  estado VARCHAR(20) DEFAULT 'DISPONIBLE' COMMENT 'DISPONIBLE / AGOTADO / DESCONTINUADO',
  fecha_registro TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_producto),
  UNIQUE KEY codigo_sku (codigo_sku),
  KEY fk_productos_categoria (id_categoria),
  CONSTRAINT fk_productos_categoria FOREIGN KEY (id_categoria)
    REFERENCES tbl_categorias (id_categoria) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo comercial de productos';

-- -----------------------------------------------------
-- Tabla: tbl_tiendas_recojo
-- -----------------------------------------------------
CREATE TABLE tbl_tiendas_recojo (
  id_tienda INT NOT NULL AUTO_INCREMENT,
  codigo_tienda VARCHAR(30) NOT NULL,
  nombre_tienda VARCHAR(120) NOT NULL,
  direccion VARCHAR(255) NOT NULL,
  distrito VARCHAR(100) NOT NULL,
  ciudad VARCHAR(100) NOT NULL DEFAULT 'Lima',
  departamento VARCHAR(100) NOT NULL DEFAULT 'Lima',
  telefono_contacto VARCHAR(30) DEFAULT NULL,
  horario_atencion VARCHAR(120) DEFAULT 'Lunes a Sábado de 8:00 AM a 6:00 PM',
  tiempo_promedio_preparacion VARCHAR(50) DEFAULT '2 a 4 horas hábiles',
  estado VARCHAR(20) DEFAULT 'ACTIVA' COMMENT 'ACTIVA / INACTIVA',
  fecha_creacion TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_tienda),
  UNIQUE KEY codigo_tienda (codigo_tienda)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Puntos de recojo en tienda física';

-- -----------------------------------------------------
-- Tabla: tbl_pedidos
-- -----------------------------------------------------
CREATE TABLE tbl_pedidos (
  id_pedido INT NOT NULL AUTO_INCREMENT,
  codigo_ticket VARCHAR(30) NOT NULL,
  id_usuario INT NOT NULL,
  id_tienda_recojo INT NOT NULL,
  tipo_comprobante VARCHAR(20) NOT NULL DEFAULT 'BOLETA' COMMENT 'BOLETA / FACTURA',
  razon_social_nombre VARCHAR(200) NOT NULL,
  tipo_documento_comprobante VARCHAR(10) NOT NULL COMMENT 'DNI / CE / RUC',
  numero_documento_comprobante VARCHAR(20) NOT NULL,
  email_contacto VARCHAR(150) NOT NULL,
  telefono_contacto VARCHAR(20) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  igv DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  estado VARCHAR(30) DEFAULT 'VIGENTE' COMMENT 'VIGENTE / EN_PREPARACION / LISTO_PARA_RECOJO / PAGADO / ENTREGADO / CANCELADO / EXPIRADO',
  fecha_emision TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_expiracion DATETIME NOT NULL,
  persona_autorizada_recojo VARCHAR(150) DEFAULT NULL,
  dni_autorizado_recojo VARCHAR(20) DEFAULT NULL,
  observaciones TEXT,
  PRIMARY KEY (id_pedido),
  UNIQUE KEY codigo_ticket (codigo_ticket),
  KEY fk_pedidos_usuario (id_usuario),
  KEY fk_pedidos_tienda (id_tienda_recojo),
  KEY idx_pedidos_doc (numero_documento_comprobante),
  KEY idx_pedidos_estado (estado),
  CONSTRAINT fk_pedidos_usuario FOREIGN KEY (id_usuario)
    REFERENCES tbl_usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_pedidos_tienda FOREIGN KEY (id_tienda_recojo)
    REFERENCES tbl_tiendas_recojo (id_tienda) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Pedidos web con recojo en tienda física';

-- -----------------------------------------------------
-- Tabla: tbl_detalle_pedidos
-- -----------------------------------------------------
CREATE TABLE tbl_detalle_pedidos (
  id_detalle INT NOT NULL AUTO_INCREMENT,
  id_pedido INT NOT NULL,
  id_producto INT NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id_detalle),
  KEY fk_detalle_pedido (id_pedido),
  KEY fk_detalle_producto (id_producto),
  CONSTRAINT fk_detalle_pedido FOREIGN KEY (id_pedido)
    REFERENCES tbl_pedidos (id_pedido) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_detalle_producto FOREIGN KEY (id_producto)
    REFERENCES tbl_productos (id_producto) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Detalle de productos por pedido';

-- -----------------------------------------------------
-- Tabla: tbl_pagos
-- -----------------------------------------------------
CREATE TABLE tbl_pagos (
  id_pago INT NOT NULL AUTO_INCREMENT,
  id_pedido INT NOT NULL,
  id_cajero INT NOT NULL,
  metodo_pago VARCHAR(20) NOT NULL COMMENT 'EFECTIVO / TARJETA_DEBITO / TARJETA_CREDITO / YAPE / PLIN / TRANSFERENCIA',
  monto_total DECIMAL(10,2) NOT NULL,
  monto_recibido DECIMAL(10,2) NOT NULL,
  vuelto_entregado DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  numero_operacion VARCHAR(50) DEFAULT NULL,
  serie_comprobante VARCHAR(10) NOT NULL DEFAULT 'B001',
  numero_comprobante VARCHAR(20) DEFAULT NULL,
  fecha_pago TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  estado VARCHAR(20) DEFAULT 'COMPLETADO' COMMENT 'COMPLETADO / ANULADO',
  PRIMARY KEY (id_pago),
  UNIQUE KEY id_pedido (id_pedido),
  KEY fk_pagos_cajero (id_cajero),
  KEY idx_pagos_fecha (fecha_pago),
  CONSTRAINT fk_pagos_pedido FOREIGN KEY (id_pedido)
    REFERENCES tbl_pedidos (id_pedido) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_pagos_cajero FOREIGN KEY (id_cajero)
    REFERENCES tbl_usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Registro de transacciones de pago en caja';

-- -----------------------------------------------------
-- Tabla: tbl_picking_almacen
-- -----------------------------------------------------
CREATE TABLE tbl_picking_almacen (
  id_picking INT NOT NULL AUTO_INCREMENT,
  id_pedido INT NOT NULL,
  id_almacenero INT DEFAULT NULL,
  estado_picking VARCHAR(20) DEFAULT 'PENDIENTE' COMMENT 'PENDIENTE / EN_SEPARACION / LISTO_PARA_RECOJO / ENTREGADO',
  total_items INT NOT NULL DEFAULT 0,
  items_separados INT NOT NULL DEFAULT 0,
  fecha_inicio DATETIME DEFAULT NULL,
  fecha_listo DATETIME DEFAULT NULL,
  fecha_entrega DATETIME DEFAULT NULL,
  persona_recoge VARCHAR(150) DEFAULT NULL,
  dni_recoge VARCHAR(20) DEFAULT NULL,
  observaciones_picking TEXT,
  PRIMARY KEY (id_picking),
  UNIQUE KEY id_pedido (id_pedido),
  KEY fk_picking_almacenero (id_almacenero),
  CONSTRAINT fk_picking_pedido FOREIGN KEY (id_pedido)
    REFERENCES tbl_pedidos (id_pedido) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_picking_almacenero FOREIGN KEY (id_almacenero)
    REFERENCES tbl_usuarios (id_usuario) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Gestión de preparación y entrega de pedidos';

-- -----------------------------------------------------
-- Tabla: tbl_notificaciones
-- -----------------------------------------------------
CREATE TABLE tbl_notificaciones (
  id_notificacion INT NOT NULL AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  id_pedido INT DEFAULT NULL,
  titulo VARCHAR(150) NOT NULL,
  mensaje TEXT NOT NULL,
  tipo VARCHAR(20) DEFAULT 'INFO' COMMENT 'INFO / EXITO / ALERTA / URGENTE',
  leido TINYINT(1) DEFAULT 0,
  fecha_envio TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_notificacion),
  KEY fk_notif_usuario (id_usuario),
  KEY fk_notif_pedido (id_pedido),
  CONSTRAINT fk_notif_usuario FOREIGN KEY (id_usuario)
    REFERENCES tbl_usuarios (id_usuario) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_notif_pedido FOREIGN KEY (id_pedido)
    REFERENCES tbl_pedidos (id_pedido) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Notificaciones de estado de pedidos para el cliente';

-- =====================================================
-- TABLAS NUEVAS
-- =====================================================

-- -----------------------------------------------------
-- Tabla: tbl_carrito
-- Un carrito ACTIVO por usuario; al confirmar la compra
-- pasa a CONVERTIDO y queda enlazado con su pedido.
-- -----------------------------------------------------
CREATE TABLE tbl_carrito (
  id_carrito INT NOT NULL AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  id_pedido INT DEFAULT NULL COMMENT 'Se llena cuando el carrito se convierte en pedido',
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' COMMENT 'ACTIVO / CONVERTIDO / ABANDONADO',
  fecha_creacion TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_carrito),
  KEY fk_carrito_usuario (id_usuario),
  KEY fk_carrito_pedido (id_pedido),
  KEY idx_carrito_estado (id_usuario, estado),
  CONSTRAINT fk_carrito_usuario FOREIGN KEY (id_usuario)
    REFERENCES tbl_usuarios (id_usuario) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_carrito_pedido FOREIGN KEY (id_pedido)
    REFERENCES tbl_pedidos (id_pedido) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Carrito de compras del cliente';

-- -----------------------------------------------------
-- Tabla: tbl_detalle_carrito
-- -----------------------------------------------------
CREATE TABLE tbl_detalle_carrito (
  id_detalle_carrito INT NOT NULL AUTO_INCREMENT,
  id_carrito INT NOT NULL,
  id_producto INT NOT NULL,
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10,2) NOT NULL COMMENT 'Precio al momento de agregar',
  fecha_agregado TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_detalle_carrito),
  UNIQUE KEY uq_carrito_producto (id_carrito, id_producto),
  KEY fk_detcarrito_producto (id_producto),
  CONSTRAINT chk_detcarrito_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_detcarrito_carrito FOREIGN KEY (id_carrito)
    REFERENCES tbl_carrito (id_carrito) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_detcarrito_producto FOREIGN KEY (id_producto)
    REFERENCES tbl_productos (id_producto) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Productos agregados a cada carrito';

-- -----------------------------------------------------
-- Tabla: tbl_movimientos_inventario
-- Kardex: entradas, salidas, ajustes y traslados de stock.
--  ENTRADA  -> origen NULL,  destino TIENDA/ALMACEN
--  SALIDA   -> origen TIENDA/ALMACEN, destino NULL
--  AJUSTE   -> corrección de stock en una sola ubicación
--  TRASLADO -> origen y destino distintos (ALMACEN -> TIENDA)
-- -----------------------------------------------------
CREATE TABLE tbl_movimientos_inventario (
  id_movimiento INT NOT NULL AUTO_INCREMENT,
  id_producto INT NOT NULL,
  id_usuario INT NOT NULL COMMENT 'Quien registró el movimiento',
  id_pedido INT DEFAULT NULL COMMENT 'Pedido que originó la salida (si aplica)',
  tipo_movimiento VARCHAR(20) NOT NULL COMMENT 'ENTRADA / SALIDA / AJUSTE / TRASLADO',
  ubicacion_origen VARCHAR(20) DEFAULT NULL COMMENT 'TIENDA / ALMACEN',
  ubicacion_destino VARCHAR(20) DEFAULT NULL COMMENT 'TIENDA / ALMACEN',
  cantidad INT NOT NULL COMMENT 'Siempre positiva; el tipo indica el sentido',
  stock_anterior INT NOT NULL COMMENT 'Stock de la ubicación afectada antes del movimiento',
  stock_posterior INT NOT NULL COMMENT 'Stock de la ubicación afectada después del movimiento',
  motivo VARCHAR(255) DEFAULT NULL,
  fecha_movimiento TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_movimiento),
  KEY fk_mov_producto (id_producto),
  KEY fk_mov_usuario (id_usuario),
  KEY fk_mov_pedido (id_pedido),
  KEY idx_mov_fecha (fecha_movimiento),
  KEY idx_mov_tipo (tipo_movimiento),
  CONSTRAINT chk_mov_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_mov_producto FOREIGN KEY (id_producto)
    REFERENCES tbl_productos (id_producto) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_mov_usuario FOREIGN KEY (id_usuario)
    REFERENCES tbl_usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_mov_pedido FOREIGN KEY (id_pedido)
    REFERENCES tbl_pedidos (id_pedido) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Kardex: movimientos de inventario por producto';
