# Sistema veterinario HTML para Wamp

Esta edición mantiene el frontend en HTML, CSS y JavaScript nativo. Recupera el diseño de referencia y agrega Usuarios, Perfiles y Permisos, conectados a la API PHP con verificación de permisos del lado del servidor. No requiere React ni Node.js.

## Instalar en Wamp

1. Haz una copia de seguridad de la carpeta actual y de la base de datos.
2. Extrae el contenido de este ZIP dentro de `C:\wamp64\www\sistema`, aceptando reemplazar los archivos del programa. Conserva `backend/api/config.php` si ya existe y conserva `backend/api/storage/fotos` para no perder las fotos.
3. En phpMyAdmin, con MySQL encendido:
   - Si es una instalación nueva, importa primero `database/schema.sql`.
   - Importa también `database/migracion_usuarios_permisos.sql` para crear perfiles, permisos y usuarios.
4. Si aún no tienes configuración, copia `backend/api/config.example.php` como `backend/api/config.php`. En Wamp suele funcionar `host=localhost`, usuario `root` y contraseña vacía. Mantén tu configuración existente si ya estaba conectada a la base.
5. Genera el hash para la clave inicial desde PowerShell, usando el `php.exe` de tu versión de Wamp:

   ```powershell
   php -r "echo password_hash('TuClaveSegura', PASSWORD_DEFAULT);"
   ```

   Sustituye `REEMPLAZA_POR_HASH_GENERADO` en `backend/api/config.php` por el resultado. La primera entrada crea el usuario configurado como perfil protegido **Dueño**. Usa el nombre y la contraseña que definiste ahí.
6. Enciende Apache y MySQL en Wamp y abre `http://localhost/sistema/`.

## Funciones añadidas y conservadas

- El menú muestra Usuarios, Perfiles y Permisos según los permisos asignados a la cuenta.
- Usuarios: crear, editar, activar/desactivar y eliminar cuentas; no se puede eliminar la cuenta propia.
- Perfiles: crear, editar, buscar y eliminar perfiles; el perfil Dueño está protegido.
- Permisos: administrar permisos y asignarlos/revocarlos por perfil desde una matriz.
- El servidor vuelve a comprobar el permiso en cada petición. El menú solo oculta las opciones no autorizadas.
- Se conservan pacientes, expedientes, fotos, citas, historial, administración, diagnóstico y carnets PDF.
- FPDF está incluido para imprimir carnets.
