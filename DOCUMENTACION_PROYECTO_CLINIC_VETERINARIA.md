# Documentación técnica del proyecto --- Clinic Veterinaria

**Estado:** En desarrollo\
**Fuente:** análisis del repositorio representado en
`repomix-output(2).xml`\
**Propósito de este documento:** servir como documentación viva para
continuar el desarrollo sin perder el contexto de la arquitectura, las
funcionalidades existentes, las decisiones tomadas y los pendientes.

> **Importante:** esta documentación describe el estado que realmente
> aparece en el código analizado. No se deben asumir como implementadas
> funcionalidades que no aparecen en el repositorio.

------------------------------------------------------------------------

## 1. Resumen del proyecto

El proyecto es un sistema web para la gestión de una clínica
veterinaria. Actualmente permite:

-   iniciar sesión mediante un usuario administrador;
-   consultar un dashboard con indicadores;
-   registrar pacientes/mascotas;
-   asociar una foto a cada paciente;
-   buscar pacientes por nombre o propietario;
-   consultar especies;
-   registrar citas;
-   impedir que se registre otra cita programada en la misma fecha y
    hora mediante una validación en servidor;
-   cambiar el estado de una cita;
-   consultar el historial de citas con filtros;
-   ejecutar un diagnóstico básico de la instalación;
-   configurar nombre, nombre corto, datos de la clínica y colores desde
    `config.php`.

La arquitectura actual está separada en tres capas principales:

1.  **Frontend:** React + Vite.
2.  **Backend:** PHP, funcionando como API.
3.  **Persistencia:** MySQL.

El flujo general es:

``` text
Navegador
   ↓
React / Vite
   ↓
frontend/src/api.js
   ↓ HTTP/JSON o FormData
backend/api/index.php
   ↓ PDO
MySQL
```

Las fotografías se almacenan en:

``` text
backend/api/storage/fotos/
```

y el acceso directo a esa carpeta está bloqueado mediante `.htaccess`.

------------------------------------------------------------------------

# 2. Estructura actual del proyecto

``` text
/
├── backend/
│   └── api/
│       ├── storage/
│       │   └── fotos/
│       │       ├── .htaccess
│       │       └── archivos de fotografías
│       ├── config.php
│       └── index.php
│
├── database/
│   └── schema.sql
│
├── frontend/
│   ├── src/
│   │   ├── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── styles.css
│   │   └── tokens.css
│   ├── .gitignore
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

------------------------------------------------------------------------

# 3. Tecnologías utilizadas

## Frontend

-   React 18.3.1
-   React DOM 18.3.1
-   Vite 5.4.0
-   `lucide-react` 0.441.0
-   JavaScript/JSX
-   CSS

## Backend

-   PHP
-   PDO
-   MySQL
-   Sesiones PHP
-   JSON como formato principal de respuesta
-   `FormData` para subida de fotografías

## Base de datos

-   MySQL
-   Motor InnoDB
-   Codificación `utf8mb4`
-   Claves foráneas

------------------------------------------------------------------------

# 4. Arquitectura del backend

El archivo central del backend es:

``` text
backend/api/index.php
```

Este archivo funciona como una API sencilla basada en el parámetro:

``` text
?r=...
```

Ejemplo:

``` text
api/index.php?r=pacientes
```

La API distingue entre rutas públicas y rutas que requieren
autenticación.

## 4.1 Rutas públicas

Actualmente existen:

``` text
config
sesion
login
logout
```

### `config`

Devuelve:

-   nombre del sistema;
-   nombre corto;
-   colores;
-   datos de la clínica.

### `sesion`

Indica si existe una sesión autenticada.

Respuesta conceptual:

``` json
{
  "autenticado": true
}
```

### `login`

Método:

``` text
POST
```

Recibe:

``` text
usuario
clave
```

El usuario se compara con el usuario configurado y la contraseña se
valida mediante:

``` php
password_verify()
```

Al iniciar sesión correctamente se regenera el identificador de sesión.

### `logout`

Destruye la sesión actual.

------------------------------------------------------------------------

# 5. Autenticación y sesión

El sistema actualmente utiliza un único usuario administrativo definido
en:

``` text
backend/api/config.php
```

La estructura es:

``` php
'admin' => [
    'usuario' => 'admin',
    'hash'    => '...'
],
```

La contraseña no se guarda en texto plano. Se almacena un hash
compatible con `password_verify()`.

Las cookies de sesión están configuradas con:

``` text
HttpOnly
SameSite=Lax
Secure cuando existe HTTPS
```

## Limitación actual

No existen:

-   múltiples usuarios;
-   roles;
-   permisos por módulo;
-   recuperación de contraseña;
-   bloqueo después de varios intentos;
-   bitácora de accesos;
-   bitácora de cambios.

Esto debe considerarse antes de utilizar el sistema en producción.

------------------------------------------------------------------------

# 6. Configuración del sistema

Archivo:

``` text
backend/api/config.php
```

Actualmente contiene:

## Identidad

``` text
nombreSistema
nombreCorto
```

## Zona horaria

``` text
America/Mexico_City
```

## Datos de la clínica

-   médico veterinario;
-   cédula;
-   dirección;
-   teléfono.

## Base de datos

Contiene:

``` text
host
name
user
pass
```

En el estado analizado aparece:

``` text
host = localhost:3308
name = clinica_veterinaria
user = root
pass = vacío
```

**Este dato debe comprobarse antes de ejecutar el proyecto**, porque el
README contiene instrucciones diferentes.

## Colores

Los colores se centralizan en `config.php` y después React los carga
dinámicamente como variables CSS.

------------------------------------------------------------------------

# 7. Base de datos

Archivo:

``` text
database/schema.sql
```

Actualmente aparecen tres tablas:

``` text
especies
pacientes
citas
```

## 7.1 Tabla `especies`

Campos:

``` text
id
nombre
```

La tabla incluye inicialmente:

``` text
Canino
Felino
Ave
Otro
```

`nombre` es único.

------------------------------------------------------------------------

# 8. Tabla `pacientes`

Estructura actual:

``` text
id
nombre
especie
propietario
telefono
foto
notas
creado_en
```

## Relaciones

Actualmente no existe una tabla separada para propietarios.

El propietario se guarda directamente como texto dentro de `pacientes`.

## Fotografía

El campo:

``` text
foto
```

guarda el nombre del archivo, no la imagen completa.

La fotografía se almacena físicamente en:

``` text
backend/api/storage/fotos/
```

Esto es preferible a guardar binarios grandes directamente en MySQL para
este proyecto.

------------------------------------------------------------------------

# 9. Tabla `citas`

Estructura:

``` text
id
paciente_id
fecha
hora
motivo
estado
observaciones
usuario
creado_en
```

Estados permitidos:

``` text
PROGRAMADA
ATENDIDA
CANCELADA
NO_ASISTIO
```

La relación principal es:

``` text
citas.paciente_id
        ↓
pacientes.id
```

La clave foránea utiliza:

``` text
ON DELETE RESTRICT
```

Esto evita eliminar un paciente que tenga citas relacionadas si
posteriormente se implementara eliminación.

------------------------------------------------------------------------

# 10. Flujo de una cita

El flujo actual es:

``` text
Seleccionar paciente
        ↓
Seleccionar fecha
        ↓
Seleccionar hora
        ↓
Introducir motivo
        ↓
Introducir observaciones
        ↓
POST /api/index.php?r=citas
        ↓
Validar paciente
        ↓
Validar fecha
        ↓
Validar hora
        ↓
Comprobar cita programada existente
        ↓
Insertar cita
        ↓
Confirmar transacción
```

El backend realiza las validaciones principales, por lo que no depende
únicamente de la validación visual de React.

------------------------------------------------------------------------

# 11. API de pacientes

Ruta:

``` text
?r=pacientes
```

## GET

Sin búsqueda:

``` text
GET ?r=pacientes
```

devuelve los pacientes ordenados por nombre.

Con búsqueda:

``` text
GET ?r=pacientes&q=texto
```

busca por:

``` text
nombre
propietario
```

## POST

Permite registrar un paciente.

Campos actuales:

``` text
nombre
especie
propietario
telefono
notas
foto
```

El nombre es obligatorio y requiere como mínimo dos caracteres.

------------------------------------------------------------------------

# 12. Subida de fotografías

La API acepta:

``` text
JPG
PNG
WEBP
```

Límite actual:

``` text
3 MB
```

El backend no confía únicamente en la extensión del archivo. Comprueba
el MIME mediante `fileinfo`.

El nombre final se genera aleatoriamente:

``` php
bin2hex(random_bytes(12))
```

Esto evita depender del nombre enviado por el usuario.

------------------------------------------------------------------------

# 13. Acceso a fotografías

Las fotografías no se sirven directamente desde la carpeta.

El archivo:

``` text
backend/api/storage/fotos/.htaccess
```

contiene una regla para denegar el acceso directo.

La aplicación utiliza:

``` text
?r=foto&id=ID
```

El backend:

1.  comprueba el paciente;
2.  obtiene el nombre de la foto;
3.  construye la ruta;
4.  verifica que exista;
5.  determina el MIME;
6.  devuelve el archivo.

Esto permite mantener el acceso protegido por la sesión del sistema.

------------------------------------------------------------------------

# 14. API de citas

Ruta:

``` text
?r=citas
```

## GET

Permite filtrar por:

``` text
desde
hasta
estado
```

Ejemplo conceptual:

``` text
?r=citas&desde=2026-09-26&estado=PROGRAMADA
```

## POST

Registra una nueva cita.

Requiere:

``` text
idPaciente
fecha
hora
```

Opcionales:

``` text
motivo
observaciones
```

Antes de insertar se comprueba que:

-   el paciente exista;
-   la fecha sea válida;
-   la hora sea válida;
-   no exista otra cita `PROGRAMADA` en esa misma fecha y hora.

------------------------------------------------------------------------

# 15. Cambio de estado de citas

Ruta:

``` text
?r=cita_estado
```

Método:

``` text
POST
```

Recibe:

``` text
id
estado
```

El estado debe pertenecer al conjunto definido por:

``` php
ESTADOS = [
    'PROGRAMADA',
    'ATENDIDA',
    'CANCELADA',
    'NO_ASISTIO'
];
```

------------------------------------------------------------------------

# 16. Dashboard

El dashboard obtiene un resumen mediante:

``` text
?r=resumen
```

Actualmente calcula:

``` text
totalPacientes
citasHoy
citasSemana
citasProgramadas
```

También muestra las citas programadas del día.

La interfaz utiliza skeletons mientras llegan los datos.

------------------------------------------------------------------------

# 17. Frontend

El componente principal es:

``` text
frontend/src/App.jsx
```

Actualmente concentra las vistas principales:

``` text
Login
Dashboard
Pacientes
Citas
Historial
Configuracion
Sidebar
TablaCitas
ModalConfirmar
```

------------------------------------------------------------------------

# 18. Vista Login

Permite introducir:

``` text
usuario
contraseña
```

Cuando el backend responde correctamente:

``` text
auth = true
```

y se muestra la aplicación.

Si ocurre un error se muestra un mensaje accesible mediante `aria-live`.

------------------------------------------------------------------------

# 19. Vista Dashboard

Muestra:

-   saludo según la hora;
-   cantidad de pacientes;
-   citas de hoy;
-   citas de los próximos siete días;
-   citas programadas;
-   tabla de citas del día.

------------------------------------------------------------------------

# 20. Vista Pacientes

Permite:

1.  registrar paciente;
2.  seleccionar especie;
3.  registrar propietario;
4.  registrar teléfono;
5.  escribir notas;
6.  subir fotografía;
7.  visualizar vista previa;
8.  buscar pacientes.

La búsqueda tiene un pequeño retraso de 250 ms para evitar realizar una
petición al servidor por cada pulsación inmediata.

Actualmente **no existe edición ni eliminación de pacientes**.

------------------------------------------------------------------------

# 21. Vista Citas

Permite:

-   seleccionar paciente;
-   seleccionar fecha;
-   seleccionar hora;
-   registrar motivo;
-   registrar observaciones;
-   agendar;
-   limpiar formulario;
-   consultar próximas citas;
-   actualizar la lista;
-   cambiar estado.

------------------------------------------------------------------------

# 22. Vista Historial

Permite consultar citas mediante:

``` text
Estado
Desde
Hasta
```

Los filtros de fecha están ocultos inicialmente y se muestran mediante
`<details>`.

Esto mantiene la interfaz sencilla cuando solamente se necesita filtrar
por estado.

------------------------------------------------------------------------

# 23. Vista Configuración

Actualmente no funciona como un panel completo de configuración.

Su función principal es ejecutar:

``` text
?r=diagnostico
```

El diagnóstico comprueba:

-   existencia de las tablas;
-   permisos de escritura de `storage/fotos`;
-   que exista un hash de administrador configurado.

Por tanto, el nombre "Configuración" puede mantenerse por ahora, pero
funcionalmente es más cercano a un módulo de **Diagnóstico del
sistema**.

------------------------------------------------------------------------

# 24. Comunicación React ↔ PHP

Archivo:

``` text
frontend/src/api.js
```

La función principal es:

``` javascript
api(ruta, opciones)
```

Construye solicitudes como:

``` text
api/index.php?r=pacientes
```

Utiliza:

``` javascript
credentials: 'same-origin'
```

Para JSON utiliza:

``` text
Content-Type: application/json
```

Para fotografías utiliza:

``` text
FormData
```

Si el servidor devuelve:

``` text
401
```

se dispara:

``` text
sesion-expirada
```

y React vuelve al estado de autenticación.

------------------------------------------------------------------------

# 25. Diseño visual

Los estilos principales están en:

``` text
frontend/src/styles.css
```

Los valores reutilizables están en:

``` text
frontend/src/tokens.css
```

Los tokens incluyen:

-   colores;
-   espaciado;
-   tipografía;
-   radios;
-   sombras;
-   transiciones;
-   dimensiones del sidebar;
-   tamaños de fotografías.

Los colores de marca pueden sobrescribirse desde `config.php`.

Esto permite reutilizar la interfaz para diferentes clientes sin
modificar todos los estilos.

------------------------------------------------------------------------

# 26. Accesibilidad implementada

El proyecto ya incorpora varias decisiones útiles:

-   `aria-live` para mensajes;
-   `role="alert"` en errores;
-   `role="status"` en mensajes informativos;
-   etiquetas asociadas a controles;
-   `aria-label`;
-   `aria-current`;
-   navegación mediante teclado;
-   enlace "Saltar al contenido";
-   foco visible;
-   soporte de `prefers-reduced-motion`;
-   modal con Escape;
-   foco inicial en Cancelar;
-   textos para lectores de pantalla.

Esto debe conservarse al seguir desarrollando.

------------------------------------------------------------------------

# 27. Vite y entorno de desarrollo

Archivo:

``` text
frontend/vite.config.js
```

El frontend usa:

``` text
http://localhost:5173
```

El proxy de desarrollo apunta a:

``` text
http://localhost:8000
```

Por ello el desarrollo local requiere dos procesos:

### PHP

``` text
php -S localhost:8000
```

desde:

``` text
backend/api
```

### React

``` text
npm install
npm run dev
```

desde:

``` text
frontend
```

------------------------------------------------------------------------

# 28. Problemas e inconsistencias detectadas

Esta sección es especialmente importante para continuar el proyecto.

## 28.1 Veterinaria vs dental

El código actual utiliza conceptos veterinarios:

``` text
Clinic Veterinaria
especies
pacientes
propietario
mascota
Canino
Felino
Ave
```

Pero existen rastros de una versión dental.

Por ejemplo:

``` text
README.md
```

se titula:

``` text
Sistema de Gestión Dental
```

y `package.json` contiene:

``` text
clinica-dental-frontend
```

Además, el README menciona:

``` text
generos
contacto
```

mientras que el SQL actual utiliza:

``` text
especies
propietario
telefono
```

### Recomendación de desarrollo

Antes de ampliar funcionalidades, definir oficialmente si el producto
será:

``` text
Veterinario
```

o:

``` text
Dental
```

No conviene seguir agregando módulos mientras estos conceptos estén
mezclados.

------------------------------------------------------------------------

## 28.2 Nombre de base de datos

El código actual utiliza:

``` text
clinica_veterinaria
```

El README hace referencia a:

``` text
clinica_dental
```

Debe quedar un único nombre.

------------------------------------------------------------------------

## 28.3 Puerto MySQL

`config.php` actualmente utiliza:

``` text
localhost:3308
```

El README indica una configuración de XAMPP que podría utilizar el
puerto estándar.

Antes de continuar, verificar qué puerto utiliza realmente MySQL en el
entorno de desarrollo.

------------------------------------------------------------------------

## 28.4 Nombre del log

En `index.php` aparece:

``` php
error_log('[dental] ' . $e->getMessage());
```

Es un residuo de la versión anterior y debería cambiarse cuando se haga
la limpieza de nombres.

------------------------------------------------------------------------

## 28.5 Integridad contra citas duplicadas

El backend comprueba si existe una cita programada para la misma fecha y
hora.

Sin embargo, la base de datos no tiene una restricción `UNIQUE`
equivalente.

Para una aplicación de producción convendría estudiar una protección a
nivel de base de datos, no solamente a nivel de aplicación,
especialmente ante solicitudes simultáneas.

------------------------------------------------------------------------

# 29. Funcionalidades que actualmente NO existen

No deben considerarse implementadas:

-   editar pacientes;
-   eliminar pacientes;
-   editar citas;
-   eliminar citas;
-   odontograma;
-   expediente clínico veterinario completo;
-   historial médico estructurado;
-   tratamientos;
-   vacunas;
-   medicamentos;
-   recetas;
-   archivos adjuntos adicionales;
-   pagos;
-   facturación;
-   reportes;
-   exportación a PDF;
-   exportación a Excel;
-   múltiples usuarios;
-   roles;
-   permisos;
-   auditoría;
-   recuperación de contraseña;
-   bloqueo por intentos de login;
-   recuperación ante desastres;
-   respaldos automáticos;
-   notificaciones;
-   correo;
-   WhatsApp;
-   calendario visual;
-   búsqueda avanzada de pacientes.

Estas son oportunidades de desarrollo, no funcionalidades existentes.

------------------------------------------------------------------------

# 30. Seguridad actual

## Aspectos positivos

-   contraseñas mediante hash;
-   `password_verify`;
-   regeneración del ID de sesión después del login;
-   cookies `HttpOnly`;
-   `SameSite=Lax`;
-   `Secure` cuando corresponde;
-   consultas preparadas con PDO en las operaciones principales;
-   validación MIME de imágenes;
-   límite de tamaño de imágenes;
-   nombres aleatorios para imágenes;
-   fotografías protegidas contra acceso directo;
-   endpoints privados protegidos por sesión.

## Aspectos pendientes

Para producción se recomienda revisar:

-   protección CSRF;
-   rate limiting del login;
-   política de contraseñas;
-   gestión de usuarios;
-   auditoría;
-   headers de seguridad;
-   HTTPS obligatorio;
-   política de sesiones;
-   backups;
-   control de permisos de archivos;
-   validación más estricta de datos;
-   restricciones de base de datos contra duplicados.

------------------------------------------------------------------------

# 31. Plan recomendado de desarrollo

El proyecto todavía no está terminado. Para continuar sin desordenar la
arquitectura, conviene trabajar por fases.

## Fase 1 --- Limpieza y estabilización

Antes de agregar funciones:

-   decidir si el sistema es veterinario;
-   corregir `README.md`;
-   corregir el nombre de `package.json`;
-   corregir mensajes heredados de dental;
-   verificar nombre de base de datos;
-   verificar puerto MySQL;
-   verificar configuración de PHP;
-   probar login;
-   probar pacientes;
-   probar fotos;
-   probar citas;
-   probar historial;
-   probar diagnóstico.

## Fase 2 --- CRUD de pacientes

Agregar:

``` text
Ver detalle
Editar paciente
Actualizar foto
Eliminar/archivar paciente
```

Preferiblemente estudiar primero un mecanismo de **archivado** antes que
un borrado físico.

## Fase 3 --- Expediente veterinario

Agregar módulos como:

``` text
Datos clínicos
Antecedentes
Alergias
Vacunas
Peso
Consultas
Diagnósticos
Tratamientos
Medicamentos
Notas clínicas
```

El expediente debe quedar relacionado con el paciente.

## Fase 4 --- Agenda

Mejorar:

``` text
calendario mensual
calendario semanal
horarios disponibles
duración de consulta
bloqueos de horario
reprogramación
```

## Fase 5 --- Usuarios y permisos

Evolucionar de:

``` text
1 administrador
```

a:

``` text
Administrador
Veterinario
Recepción
```

con permisos definidos.

## Fase 6 --- Seguridad y producción

Implementar:

``` text
CSRF
rate limiting
auditoría
backups
HTTPS obligatorio
headers de seguridad
política de contraseñas
```

## Fase 7 --- Reportes

Después de estabilizar los datos:

``` text
pacientes registrados
citas atendidas
cancelaciones
no asistencias
consultas por periodo
```

------------------------------------------------------------------------

# 32. Reglas para continuar desarrollando

Estas reglas deberían mantenerse para evitar que el proyecto se vuelva
difícil de mantener.

### Regla 1

No meter consultas SQL directamente dentro de React.

React debe comunicarse con:

``` text
api.js
```

y PHP debe encargarse de la base de datos.

### Regla 2

Las validaciones importantes deben existir en PHP.

La validación de React mejora la experiencia, pero no sustituye la
validación del servidor.

### Regla 3

No guardar fotografías como Base64 dentro de MySQL.

Mantener:

``` text
archivo → storage
nombre → pacientes.foto
```

### Regla 4

No duplicar colores y medidas por todo `styles.css`.

Utilizar:

``` text
tokens.css
```

### Regla 5

Cada nueva ruta de API debe definir claramente:

``` text
nombre
método
parámetros
respuesta
errores
autenticación
```

### Regla 6

Antes de eliminar datos clínicos, estudiar archivado.

### Regla 7

Toda funcionalidad nueva debe probarse primero en local.

------------------------------------------------------------------------

# 33. Checklist para una nueva funcionalidad

Antes de considerar terminada una funcionalidad:

``` text
[ ] Base de datos actualizada
[ ] Backend actualizado
[ ] Endpoint documentado
[ ] Validación en PHP
[ ] Interfaz React
[ ] Mensajes de error
[ ] Mensajes de éxito
[ ] Accesibilidad
[ ] Prueba normal
[ ] Prueba con datos inválidos
[ ] Prueba sin sesión
[ ] Prueba de errores de BD
[ ] Revisión de seguridad
[ ] Actualización de documentación
```

------------------------------------------------------------------------

# 34. Flujo recomendado de Git para continuar

Para cada funcionalidad:

``` text
main
  │
  └── develop
        │
        └── feature/nombre-funcionalidad
```

Ejemplo:

``` text
feature/editar-pacientes
```

Trabajar ahí, probar y posteriormente integrar a `develop`.

Cuando el conjunto de cambios esté estable:

``` text
develop → main
```

No conviene realizar cambios grandes directamente sobre `main`.

------------------------------------------------------------------------

# 35. Checklist de prueba actual

Antes de agregar nuevos módulos, comprobar:

## Autenticación

``` text
[ ] Login correcto
[ ] Login incorrecto
[ ] Sesión persistente
[ ] Logout
[ ] Acceso sin sesión bloqueado
```

## Pacientes

``` text
[ ] Crear paciente
[ ] Crear paciente sin nombre
[ ] Crear paciente con nombre corto
[ ] Subir JPG
[ ] Subir PNG
[ ] Subir WEBP
[ ] Rechazar archivo no permitido
[ ] Rechazar archivo > 3 MB
[ ] Buscar paciente
[ ] Buscar propietario
```

## Citas

``` text
[ ] Crear cita
[ ] Fecha inválida
[ ] Hora inválida
[ ] Paciente inexistente
[ ] Cita duplicada
[ ] Cambiar a ATENDIDA
[ ] Cambiar a CANCELADA
[ ] Consultar historial
[ ] Filtrar por estado
[ ] Filtrar por fecha
```

## Diagnóstico

``` text
[ ] Tablas existentes
[ ] Carpeta de fotos escribible
[ ] Hash configurado
```

------------------------------------------------------------------------

# 36. Punto de partida para el siguiente desarrollo

La recomendación técnica es **no comenzar todavía con módulos grandes**.

Primero debe hacerse una tarea de estabilización:

``` text
1. Unificar identidad veterinaria.
2. Corregir README.
3. Corregir nombres heredados de dental.
4. Confirmar puerto y BD.
5. Ejecutar pruebas del sistema actual.
6. Crear una copia/commit estable.
7. Después comenzar el siguiente módulo.
```

El primer módulo funcional que tiene sentido ampliar es:

``` text
Pacientes
```

porque actualmente solamente permite crear y buscar.

Una evolución razonable sería:

``` text
Pacientes
   ↓
Lista
   ↓
Detalle
   ↓
Editar
   ↓
Expediente
   ↓
Historial clínico
   ↓
Citas relacionadas
```

La agenda debería crecer después de que la entidad `paciente` esté
correctamente definida.

------------------------------------------------------------------------

# 37. Referencia rápida de archivos

  ---------------------------------------------------------------------------
  Archivo                                 Responsabilidad
  --------------------------------------- -----------------------------------
  `backend/api/config.php`                Configuración del sistema

  `backend/api/index.php`                 API y lógica del servidor

  `backend/api/storage/fotos/.htaccess`   Bloqueo de acceso directo a fotos

  `database/schema.sql`                   Estructura de MySQL

  `frontend/src/api.js`                   Comunicación React/PHP

  `frontend/src/App.jsx`                  Vistas y lógica principal

  `frontend/src/main.jsx`                 Punto de entrada React

  `frontend/src/styles.css`               Estilos de interfaz

  `frontend/src/tokens.css`               Variables de diseño

  `frontend/index.html`                   HTML base

  `frontend/package.json`                 Dependencias y scripts

  `frontend/vite.config.js`               Configuración Vite

  `README.md`                             Guía actual del proyecto, pendiente
                                          de actualizar
  ---------------------------------------------------------------------------

------------------------------------------------------------------------

# 38. Conclusión del estado actual

El proyecto ya tiene una base funcional de:

``` text
Autenticación
      +
Dashboard
      +
Pacientes
      +
Fotografías
      +
Citas
      +
Historial
      +
Diagnóstico
      +
MySQL
      +
React
      +
PHP
```

La arquitectura es suficientemente clara para continuar, pero **antes de
seguir agregando módulos hay que resolver la mezcla entre la antigua
versión dental y la actual versión veterinaria**.

La documentación debe actualizarse cada vez que se agregue:

-   una tabla;
-   un endpoint;
-   una pantalla;
-   una relación;
-   un mecanismo de autenticación;
-   una funcionalidad importante.

Así este documento puede utilizarse como referencia para futuras
sesiones de desarrollo y para reconstruir rápidamente el contexto del
proyecto.
