-- =====================================================
-- AGROINPERU · Fotos reales de los 401 productos
-- Ejecutar UNA vez en Supabase → SQL Editor.
-- No borra nada: solo cambia la ruta de la imagen de cada producto.
-- La foto del producto N está en frontend/public/img/productos/fotos/NNN.jpg
-- =====================================================

UPDATE tbl_productos
   SET imagen_url = 'img/productos/fotos/' || LPAD(id_producto::text, 3, '0') || '.jpg'
 WHERE id_producto BETWEEN 1 AND 401;

-- Comprobación: debe mostrar 401
SELECT COUNT(*) AS productos_con_foto_real
  FROM tbl_productos
 WHERE imagen_url LIKE 'img/productos/fotos/%';
