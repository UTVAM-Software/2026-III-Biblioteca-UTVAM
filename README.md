# Sistema de Gestión Dental (PHP + React + MySQL)

Versión para consultorio dental del sistema de Pacientes/Citas. Conserva la lógica original
(Dashboard, Pacientes con foto, Citas, Historial, Configuración, colores y nombre configurables),
pero ahora corre con **PHP** (servidor), **React** (pantalla) y **MySQL** (base de datos)
en lugar de Google Apps Script + Google Sheets.

## Qué cambió respecto al original

| Original (Apps Script) | Ahora |
|---|---|
| Google Sheets guarda los datos | MySQL (tablas `pacientes`, `citas`, `generos`) |
| Fotos en Google Drive (link público) | Fotos en `backend/api/storage/fotos`, solo visibles con sesión iniciada |
| `Code.gs` | `backend/api/index.php` + `backend/api/config.php` |
| `index.html` | `frontend/src/App.jsx` |
| Sin login (dependía de Google) | Login con usuario/contraseña |
| Cita identificada por paciente+fecha+hora | Cada cita tiene su propio `id` |
| "Especie/Tipo", "Propietario" | "Género", "Contacto" |
| "Inicializar hojas" | Se importa `database/schema.sql` una vez; "Verificar sistema" revisa que todo esté bien |

## Estructura

```
clinica-dental/
├── database/schema.sql        ← crea las tablas
├── backend/api/
│   ├── config.php             ← EDITAS ESTO por cliente (nombre, BD, contraseña, colores)
│   ├── index.php              ← toda la lógica del servidor (la "API")
│   └── storage/fotos/         ← aquí se guardan las fotos
└── frontend/
    ├── src/App.jsx            ← todas las pantallas
    ├── src/api.js             ← cómo React le habla a PHP
    └── src/styles.css         ← estilos
```

**Cómo hablan entre sí:** el navegador carga React → React pide datos a `api/index.php?r=pacientes`
→ PHP consulta MySQL → responde JSON → React lo dibuja.

---

## PARTE 1 — Instalar lo necesario (Windows)

1. **XAMPP** (trae PHP, MySQL y phpMyAdmin): https://www.apachefriends.org → instala la versión con **PHP 8.1 o mayor**.
   Instálalo en `C:\xampp`. Abre "XAMPP Control Panel" y pulsa **Start** en *Apache* y *MySQL*.
2. **Node.js LTS** (para React): https://nodejs.org → siguiente, siguiente, finalizar.
   Comprueba en una terminal (PowerShell): `node -v` y `npm -v` deben mostrar un número.
3. **VS Code** (editor): https://code.visualstudio.com

> Mac/Linux: usa `php` y `mysql` de Homebrew/apt, o MAMP/XAMPP. Los pasos son iguales.

## PARTE 2 — Preparar la base de datos

1. Abre http://localhost/phpmyadmin
2. Pestaña **Importar** → *Seleccionar archivo* → `database/schema.sql` → **Importar**.
3. A la izquierda debe aparecer la base `clinica_dental` con 3 tablas: `generos`, `pacientes`, `citas`.

## PARTE 3 — Configurar

1. Abre `backend/api/config.php`.
2. Cambia `nombreSistema`, `nombreCorto` y colores si quieres.
3. En XAMPP la BD ya funciona con `root` y contraseña vacía. No cambies nada de `db` en local.
4. **Crea tu contraseña.** En PowerShell:
   ```
   C:\xampp\php\php.exe -r "echo password_hash('PonAquiTuClave', PASSWORD_DEFAULT);"
   ```
   Copia el texto que sale (empieza con `$2y$`) y pégalo en `'hash' => '...'` entre comillas simples.
   Tu usuario es el de `'usuario'` (por defecto `admin`).
5. **Instala FPDF** (necesaria para el botón "Imprimir carnet"):
   - Ve a http://www.fpdf.org/en/download.php y descarga la versión más reciente.
   - Del .zip descargado, copia solo el archivo `fpdf.php` a `backend/api/lib/fpdf/fpdf.php` de este proyecto.
   - Sin este archivo, todo lo demás del sistema funciona normal; solo el carnet en PDF da error hasta que lo instales.

## PARTE 4 — Ejecutar en modo desarrollo

Necesitas **dos terminales abiertas a la vez** (MySQL de XAMPP debe seguir encendido).

**Terminal 1 — el servidor PHP:**
```
cd clinica-dental\backend\api
C:\xampp\php\php.exe -S localhost:8000
```
Déjala abierta. Prueba abrir http://localhost:8000/index.php?r=config : debe verse un JSON con el nombre del sistema.

**Terminal 2 — React:**
```
cd clinica-dental\frontend
npm install
npm run dev
```
`npm install` solo se hace la primera vez (tarda un poco). Abre **http://localhost:5173**, inicia sesión y prueba:
agregar paciente (con foto) → agendar cita → marcarla como atendida → Historial → Configuración → *Verificar sistema*.

Cada vez que guardas un archivo, la página se actualiza sola. Para cambios en PHP solo recarga el navegador.

## PARTE 5 — Cómo modificar (lo más común)

- **Textos y nombres:** títulos y etiquetas están en `frontend/src/App.jsx` (busca el texto y cámbialo). Nombre y colores del sistema: `config.php`.
- **Opciones del campo Género:** en phpMyAdmin, tabla `generos`, agrega/edita filas.
- **Agregar un campo (ejemplo: fecha de nacimiento del paciente):**
  1. phpMyAdmin → pestaña SQL: `ALTER TABLE pacientes ADD fecha_nacimiento DATE NULL;`
  2. `index.php`, en `case 'pacientes'`: agrega `fecha_nacimiento` al `SELECT` y al `INSERT` (con su `?` y su valor en el arreglo).
  3. `App.jsx`: agrega `fecha_nacimiento: ''` a `vacioPac` y un `<input type="date">` en el formulario.
- **Nuevo cliente:** copia la carpeta completa, cambia `config.php`, crea una BD nueva. **Un cliente = su propia BD y su propio hosting**; nunca compartas datos entre clientes.

## PARTE 6 — Desplegar en un hosting (cPanel)

Necesitas un hosting con **PHP 8.1+**, **MySQL** y **certificado SSL gratis** (casi todos los de cPanel lo tienen).

1. **Crear la BD:** cPanel → *MySQL Databases* → crea una base, crea un usuario con contraseña fuerte y
   asígnalo a la base con *All Privileges*. Anota los tres nombres (cPanel les pone un prefijo, ej. `micuenta_dental`).
2. **Importar tablas:** cPanel → *phpMyAdmin* → entra a tu base → *Importar* → `schema.sql`.
   Antes de importar, **borra las 2 primeras líneas** del archivo (`CREATE DATABASE` y `USE`), porque en hosting no puedes crear bases por SQL.
3. **Editar `config.php`** con los datos reales: `host` (normalmente `localhost`), `name`, `user`, `pass` y el `hash` de tu contraseña
   (genéralo con el comando de la Parte 3; **usa una contraseña distinta a la de pruebas**).
4. **Construir React:** en `frontend` ejecuta `npm run build`. Se crea la carpeta `dist/`.
5. **Subir archivos** (cPanel → *File Manager* → `public_html`, o FileZilla):
   - El **contenido** de `frontend/dist/` (el `index.html` y la carpeta `assets/`) → directo en `public_html/`.
   - La carpeta `backend/api/` completa → `public_html/api/`.
   
   Debe quedar así: `public_html/index.html`, `public_html/assets/…`, `public_html/api/index.php`, `public_html/api/config.php`, `public_html/api/storage/fotos/`.
6. **Permisos:** `public_html/api/storage/fotos` debe poder escribirse (clic derecho → *Change Permissions* → 755; si al subir foto falla, prueba 775).
7. **HTTPS:** cPanel → *SSL/TLS Status* → activa AutoSSL. Forzar HTTPS en `public_html/.htaccess`:
   ```
   RewriteEngine On
   RewriteCond %{HTTPS} off
   RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
   ```
8. **Probar:** abre tu dominio → inicia sesión → Configuración → *Verificar sistema* debe decir "Todo correcto".
9. **Actualizaciones futuras:** cambias código → `npm run build` → vuelves a subir `dist/` (y `index.php` si cambió). **No sobrescribas `config.php` ni `storage/fotos` del servidor.**

> Si el hosting usa **Nginx** (no Apache), el `.htaccess` de `storage/fotos` no funciona. Pide a soporte bloquear esa carpeta o pon `storage` fuera de `public_html`.

## PARTE 7 — Problemas comunes

| Síntoma | Causa / solución |
|---|---|
| `could not find driver` | En XAMPP → `php.ini`, activa `extension=pdo_mysql` y `extension=fileinfo`; reinicia. |
| "Error interno del servidor" | Casi siempre credenciales de BD mal en `config.php`. El detalle está en el log de errores de PHP (`C:\xampp\php\logs\php_error_log` o cPanel → *Errors*). |
| Pantalla en blanco / no carga datos en local | ¿Está encendida la Terminal 1 (puerto 8000)? ¿Abriste 5173 y no 8000? |
| No deja iniciar sesión | El `hash` debe estar completo, entre comillas simples y sin espacios. Genera otro. |
| La foto no se sube | Pesa más de 3 MB, no es JPG/PNG/WEBP, o falta permiso en `storage/fotos`. Si es mayor a 2 MB, revisa `upload_max_filesize` en `php.ini`. |
| `npm` no se reconoce | Cierra y reabre la terminal tras instalar Node. |
| En hosting todo da 404 en `/api` | La carpeta debe llamarse exactamente `api` y estar dentro de `public_html`. |
- **Un solo usuario**, sin roles (doctor/recepción) ni bitácora de quién cambió qué.
- **Sin editar datos de un paciente ya guardado.** Sí se puede dar de baja (botón "Dar de baja" en Pacientes → Buscar): lo oculta de búsquedas y citas nuevas, pero conserva su historial. No hay un botón para editar nombre/especie/propietario todavía.
- **Sin respaldos automáticos.** Configura respaldos de la BD *y* de `storage/fotos` (cPanel → *Backup*, o exportar desde phpMyAdmin cada semana).
- **Datos de salud = datos personales sensibles.** En México aplica la LFPDPPP (aviso de privacidad, consentimiento) y para expedientes clínicos hay normas oficiales (NOM-004 / NOM-024 de la SSA). Verifica con un profesional legal antes de usarlo con pacientes reales; esto no es asesoría legal.
- **Sin límite de intentos de login** (solo una pausa de 1 s). Suficiente para pruebas, débil para producción abierta a internet.
