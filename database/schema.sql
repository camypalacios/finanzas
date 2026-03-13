-- ============================================================
-- FINANZAS APP — Schema SQL completo
-- Base de datos: u330480178_matias (Hostinger)
-- Charset: utf8mb4 | Motor: InnoDB
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

-- ── 1. USUARIOS (single user) ──────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 2. TARJETAS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tarjetas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,          -- ej: "VISA BBVA", "MASTERCARD BBVA"
  tipo ENUM('credito','debito') NOT NULL DEFAULT 'credito',
  ultimos_digitos CHAR(4) NULL,
  color_hex VARCHAR(7) DEFAULT '#1a73e8',
  activa TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. CATEGORIAS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  icono VARCHAR(50) DEFAULT 'tag',
  color_hex VARCHAR(7) DEFAULT '#00ff87',
  parent_id INT UNSIGNED NULL,           -- NULL = categoría raíz
  activa TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categorias(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. ETIQUETAS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etiquetas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  color_hex VARCHAR(7) DEFAULT '#888888',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 5. TERCEROS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS terceros (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  relacion VARCHAR(100) NULL,  -- ej: "Mamá", "Hermano"
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 6. TIPO_CAMBIO ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tipo_cambio (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL,
  usd_oficial DECIMAL(12,4) NOT NULL,
  usd_blue DECIMAL(12,4) NULL,
  usd_mep DECIMAL(12,4) NULL,
  fuente VARCHAR(50) DEFAULT 'bluelytics',
  manual TINYINT(1) DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 7. INGRESOS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingresos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  descripcion VARCHAR(255) NOT NULL,
  monto DECIMAL(14,2) NOT NULL,
  moneda ENUM('ARS','USD') NOT NULL DEFAULT 'ARS',
  fecha DATE NOT NULL,
  categoria_id INT UNSIGNED NULL,
  tercero_id INT UNSIGNED NULL,       -- ingreso de un tercero (reembolso, etc.)
  repetir_mensual TINYINT(1) DEFAULT 0,
  notas TEXT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL,
  FOREIGN KEY (tercero_id) REFERENCES terceros(id) ON DELETE SET NULL,
  INDEX idx_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 8. GASTOS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gastos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  descripcion VARCHAR(255) NOT NULL,
  monto DECIMAL(14,2) NOT NULL,
  moneda ENUM('ARS','USD') NOT NULL DEFAULT 'ARS',
  fecha DATE NOT NULL,
  categoria_id INT UNSIGNED NULL,
  tarjeta_id INT UNSIGNED NULL,        -- NULL = gasto en efectivo/contado
  tercero_id INT UNSIGNED NULL,        -- NULL = gasto propio
  es_fijo TINYINT(1) NOT NULL DEFAULT 0,   -- servicio fijo mensual
  -- Cuotas
  es_cuota TINYINT(1) NOT NULL DEFAULT 0,
  cuota_numero INT UNSIGNED NULL,      -- ej: 3
  cuota_total INT UNSIGNED NULL,       -- ej: 12
  parent_id INT UNSIGNED NULL,         -- primer gasto de la serie de cuotas
  -- PDF import
  estado ENUM('preventivo','confirmado','manual') NOT NULL DEFAULT 'manual',
  pdf_import_id INT UNSIGNED NULL,
  pdf_hash VARCHAR(64) NULL,           -- SHA256 para dedup
  cupon_nro VARCHAR(50) NULL,
  -- Notas
  notas TEXT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL,
  FOREIGN KEY (tarjeta_id) REFERENCES tarjetas(id) ON DELETE SET NULL,
  FOREIGN KEY (tercero_id) REFERENCES terceros(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_id) REFERENCES gastos(id) ON DELETE SET NULL,
  INDEX idx_fecha (fecha),
  INDEX idx_tarjeta (tarjeta_id),
  INDEX idx_pdf_hash (pdf_hash),
  INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 9. GASTO_ETIQUETAS (relación N:M) ────────────────────
CREATE TABLE IF NOT EXISTS gasto_etiquetas (
  gasto_id INT UNSIGNED NOT NULL,
  etiqueta_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (gasto_id, etiqueta_id),
  FOREIGN KEY (gasto_id) REFERENCES gastos(id) ON DELETE CASCADE,
  FOREIGN KEY (etiqueta_id) REFERENCES etiquetas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 10. METAS_AHORRO ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS metas_ahorro (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  monto_objetivo DECIMAL(14,2) NOT NULL,
  monto_actual DECIMAL(14,2) NOT NULL DEFAULT 0,
  moneda ENUM('ARS','USD') NOT NULL DEFAULT 'ARS',
  fecha_limite DATE NOT NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  descripcion TEXT NULL,
  icono VARCHAR(50) DEFAULT 'target',
  color_hex VARCHAR(7) DEFAULT '#00ff87',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 11. MOVIMIENTOS_META (historial de aportes) ───────────
CREATE TABLE IF NOT EXISTS movimientos_meta (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  meta_id INT UNSIGNED NOT NULL,
  monto DECIMAL(14,2) NOT NULL,
  moneda ENUM('ARS','USD') NOT NULL DEFAULT 'ARS',
  tipo ENUM('aporte','retiro') NOT NULL DEFAULT 'aporte',
  fecha DATE NOT NULL,
  notas VARCHAR(255) NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meta_id) REFERENCES metas_ahorro(id) ON DELETE CASCADE,
  INDEX idx_meta (meta_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 12. PDF_IMPORTS (log de importaciones) ────────────────
CREATE TABLE IF NOT EXISTS pdf_imports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tarjeta_id INT UNSIGNED NOT NULL,
  mes INT NOT NULL,    -- 1-12
  anio INT NOT NULL,
  nombre_archivo VARCHAR(255) NULL,
  total_transacciones INT DEFAULT 0,
  nuevas INT DEFAULT 0,
  actualizadas INT DEFAULT 0,
  duplicadas INT DEFAULT 0,
  estado ENUM('procesando','completado','error') DEFAULT 'procesando',
  error_msg TEXT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tarjeta_id) REFERENCES tarjetas(id) ON DELETE CASCADE,
  INDEX idx_tarjeta_mes (tarjeta_id, mes, anio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ── DATOS INICIALES ───────────────────────────────────────

-- Usuario (password_hash se actualiza con hash real de "felipe2026" al iniciar)
INSERT IGNORE INTO usuarios (nombre, username, password_hash)
VALUES ('Matías', 'matias', '$2a$10$placeholder');

-- Tarjetas por defecto
INSERT IGNORE INTO tarjetas (id, nombre, tipo, color_hex) VALUES
  (1, 'Contado / Efectivo', 'debito', '#4caf50'),
  (2, 'VISA BBVA',          'credito', '#1a73e8'),
  (3, 'MASTERCARD BBVA',    'credito', '#e53935');

-- Categorías raíz
INSERT IGNORE INTO categorias (id, nombre, icono, color_hex, parent_id) VALUES
  (1,  'Alimentación',      'utensils',    '#ff6b6b', NULL),
  (2,  'Transporte',        'car',         '#4ecdc4', NULL),
  (3,  'Vivienda',          'home',        '#45b7d1', NULL),
  (4,  'Salud',             'heart',       '#f7b731', NULL),
  (5,  'Entretenimiento',   'film',        '#a29bfe', NULL),
  (6,  'Educación',         'book',        '#fd79a8', NULL),
  (7,  'Ropa',              'shirt',       '#fdcb6e', NULL),
  (8,  'Tecnología',        'cpu',         '#74b9ff', NULL),
  (9,  'Servicios',         'zap',         '#00cec9', NULL),
  (10, 'Otros',             'tag',         '#636e72', NULL);

-- Servicios fijos (subcategorías de Servicios)
INSERT IGNORE INTO categorias (id, nombre, icono, color_hex, parent_id) VALUES
  (11, 'Internet',          'wifi',        '#00cec9', 9),
  (12, 'Televisión',        'tv',          '#00cec9', 9),
  (13, 'Teléfono',          'phone',       '#00cec9', 9),
  (14, 'Streaming',         'play-circle', '#00cec9', 9),
  (15, 'Seguro',            'shield',      '#00cec9', 9);

-- Etiquetas por defecto
INSERT IGNORE INTO etiquetas (id, nombre, color_hex) VALUES
  (1, 'Fijo mensual', '#f39c12'),
  (2, 'Urgente',      '#e74c3c'),
  (3, 'Ocio',         '#9b59b6'),
  (4, 'Trabajo',      '#3498db');
