-- Entregable 03-A: usuarios, perfiles/roles y permisos administrables desde la app.
-- Es idempotente: se puede correr varias veces sin duplicar nada.
-- Impórtalo en phpMyAdmin dentro de la base clinica_veterinaria (pestaña SQL o Importar).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE,
  descripcion VARCHAR(200) NOT NULL DEFAULT '',
  sistema TINYINT(1) NOT NULL DEFAULT 0,   -- 1 = rol protegido (no se borra ni se le quitan permisos)
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permisos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(60) NOT NULL UNIQUE,      -- ej. pacientes.crear
  descripcion VARCHAR(200) NOT NULL DEFAULT '',
  sistema TINYINT(1) NOT NULL DEFAULT 0,   -- 1 = permiso que el código del sistema ya usa (no se borra)
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rol_permiso (
  rol_id INT NOT NULL,
  permiso_id INT NOT NULL,
  PRIMARY KEY (rol_id, permiso_id),
  CONSTRAINT fk_rp_rol FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_permiso FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario VARCHAR(60) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL DEFAULT '',
  clave_hash VARCHAR(255) NOT NULL,
  rol_id INT NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuario_rol FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Roles base
INSERT IGNORE INTO roles (nombre, descripcion, sistema) VALUES
  ('Dueño', 'Acceso total al sistema. Protegido: siempre conserva todos los permisos.', 1),
  ('Operador', 'Atiende pacientes, citas y registros clínicos. Sin acceso a seguridad.', 0);

-- Permisos base (los que el backend verifica)
INSERT IGNORE INTO permisos (codigo, descripcion, sistema) VALUES
  ('pacientes.ver','Ver pacientes',1),('pacientes.crear','Registrar pacientes',1),('pacientes.editar','Editar pacientes',1),('pacientes.eliminar','Dar de baja pacientes',1),
  ('citas.ver','Ver citas',1),('citas.crear','Agendar citas',1),('citas.editar','Editar citas / cambiar estado',1),('citas.eliminar','Eliminar citas',1),
  ('registros.ver','Ver registros clínicos',1),('registros.crear','Crear registros clínicos',1),('registros.editar','Editar registros clínicos',1),('registros.eliminar','Eliminar registros clínicos',1),
  ('especies.ver','Ver especies',1),('especies.crear','Crear especies',1),('especies.editar','Editar especies',1),('especies.eliminar','Eliminar especies',1),
  ('usuarios.ver','Ver usuarios',1),('usuarios.crear','Crear usuarios',1),('usuarios.editar','Editar usuarios',1),('usuarios.eliminar','Eliminar usuarios',1),
  ('roles.ver','Ver perfiles/roles',1),('roles.crear','Crear perfiles/roles',1),('roles.editar','Editar perfiles/roles y sus permisos',1),('roles.eliminar','Eliminar perfiles/roles',1),
  ('permisos.ver','Ver permisos',1),('permisos.crear','Crear permisos',1),('permisos.editar','Editar permisos',1),('permisos.eliminar','Eliminar permisos',1),
  ('config.ver','Ver configuración y diagnóstico',1);

-- Dueño: todos los permisos
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles r CROSS JOIN permisos p WHERE r.nombre = 'Dueño';

-- Operador: operación diaria
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles r JOIN permisos p ON p.codigo IN (
    'pacientes.ver','pacientes.crear','pacientes.editar',
    'citas.ver','citas.crear','citas.editar',
    'registros.ver','registros.crear',
    'especies.ver'
  ) WHERE r.nombre = 'Operador';

-- No se siembran usuarios: en el primer inicio de sesión el sistema toma el admin de
-- config.php y lo crea aquí como "Dueño". Desde entonces el login usa esta tabla.
