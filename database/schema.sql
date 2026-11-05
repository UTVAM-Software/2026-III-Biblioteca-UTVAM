-- Sistema de Gestión Veterinaria — estructura de la base de datos
-- Impórtalo en phpMyAdmin (pestaña "Importar"). Si tu hosting ya te dio una BD vacía,
-- borra las 2 primeras líneas (CREATE DATABASE / USE) y selecciona tu BD antes de importar.
CREATE DATABASE IF NOT EXISTS clinica_veterinaria CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE clinica_veterinaria;

CREATE TABLE IF NOT EXISTS especies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB;
INSERT IGNORE INTO especies (nombre) VALUES ('Canino'), ('Felino'), ('Ave'), ('Otro');

CREATE TABLE IF NOT EXISTS pacientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  especie VARCHAR(60) NOT NULL DEFAULT '',
  propietario VARCHAR(120) NOT NULL DEFAULT '',
  telefono VARCHAR(30) NOT NULL DEFAULT '',
  foto VARCHAR(80) NOT NULL DEFAULT '',
  notas TEXT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS citas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  motivo VARCHAR(200) NOT NULL DEFAULT '',
  estado ENUM('PROGRAMADA','ATENDIDA','CANCELADA','NO_ASISTIO') NOT NULL DEFAULT 'PROGRAMADA',
  domicilio TINYINT(1) NOT NULL DEFAULT 0,
  direccion_domicilio VARCHAR(200) NULL,
  observaciones TEXT NULL,
  usuario VARCHAR(60) NOT NULL DEFAULT '',
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_fecha_hora (fecha, hora),
  CONSTRAINT fk_cita_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS registros_clinicos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT NOT NULL,
  fecha DATE NOT NULL,
  tipo ENUM('CONSULTA','VACUNA','TRATAMIENTO','CIRUGIA','OTRO') NOT NULL DEFAULT 'CONSULTA',
  descripcion TEXT NOT NULL,
  peso DECIMAL(6,2) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_paciente_fecha (paciente_id, fecha),
  CONSTRAINT fk_registro_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- MIGRACIÓN: SOLO para una base creada ANTES de estos cambios
-- (ya tiene datos, así que no se puede recrear). En una instalación
-- nueva NO hace falta: las tablas de arriba ya incluyen las columnas.
-- Para usarla, quita los "-- " del inicio de las líneas que te falten
-- y córrelas UNA sola vez en phpMyAdmin (pestaña SQL, dentro de la
-- base clinica_veterinaria). Si una columna ya existe, dará error de
-- "columna duplicada": ignóralo, significa que esa ya estaba.
-- ============================================================
-- ALTER TABLE pacientes ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1;
-- ALTER TABLE citas ADD COLUMN domicilio TINYINT(1) NOT NULL DEFAULT 0;
-- ALTER TABLE citas ADD COLUMN direccion_domicilio VARCHAR(200) NULL;
