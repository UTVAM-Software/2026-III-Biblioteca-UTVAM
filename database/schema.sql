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
-- MIGRACIÓN para una base de datos que ya tenías creada antes
-- de este cambio (ya tiene datos, así que no se puede recrear
-- la tabla). Corre esta línea UNA sola vez en phpMyAdmin, pestaña
-- SQL, dentro de tu base clinica_veterinaria. Si ya la corriste,
-- no la vuelvas a correr (dará un error de columna duplicada,
-- que puedes ignorar).
-- ============================================================
ALTER TABLE pacientes ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1;
