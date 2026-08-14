# Tech Solutions — Gestión de Proyectos

Evaluación Sumativa Unidad 2 — Desarrollo de Software Web I.

API REST con **NestJS + TypeORM + PostgreSQL** y SPA con **React + Bootstrap**.

## Stack

| Capa      | Tecnología                                             |
| --------- | ------------------------------------------------------ |
| Backend   | NestJS 11 (sobre Express), TypeScript                  |
| ORM       | TypeORM 0.3                                            |
| Base      | PostgreSQL 16                                          |
| Auth      | JWT (`@nestjs/jwt`) + bcrypt                           |
| Validación| class-validator (en el borde: DTOs del handler)        |
| Frontend  | React 19, Vite, React Router, Bootstrap 5              |

## Por qué este stack

El criterio que ordena todas las elecciones es el mismo: **cada garantía se
declara en el punto donde el sistema puede verificarla solo**, en vez de
depender de que alguien se acuerde de sostenerla. El compilador, el motor de
base de datos y el contenedor son mecanismos que fallan solos y a tiempo; la
disciplina humana no lo es. Lo que sigue detalla, tecnología por tecnología, qué
mecanismo concreto aporta cada una.

### NestJS sobre Express solo

Express resuelve enrutamiento y middleware, y nada más. Todo lo demás —cómo se
construyen las dependencias, dónde viven las preocupaciones transversales, cómo
se propagan los errores— queda como convención no verificada. NestJS aporta tres
mecanismos que este proyecto usa de forma directa:

- **Contenedor de inyección de dependencias con resolución en el arranque.** Las
  dependencias se declaran en el constructor y las resuelve el contenedor. Si un
  proveedor falta o un módulo no exporta lo que otro importa, la aplicación
  **no levanta**: falla en el `bootstrap` con la cadena de dependencias exacta.
  Ese error no puede llegar a producción, porque impide arrancar. Con
  instanciación manual, el mismo defecto se manifiesta como un `undefined` en la
  primera petición que toque ese camino.
- **Guards, pipes y filtros como ciudadanos de primera clase.** La autenticación
  vive en `JwtAuthGuard` y se aplica con `@UseGuards()` a nivel de controlador,
  de modo que **cubre todas las rutas del controlador por defecto**. Agregar un
  endpoint nuevo a `ProjectsController` lo deja protegido sin hacer nada. Con
  middleware de Express montado por ruta, cada endpoint nuevo es una oportunidad
  de olvidarse, y el olvido no produce ningún error visible: produce una ruta
  abierta.
- **Metadatos de decoradores en tiempo de ejecución.** Con
  `emitDecoratorMetadata` y `reflect-metadata`, Nest lee los tipos de los
  parámetros del handler y puede instanciar y validar el DTO correspondiente sin
  configuración adicional. Es lo que permite que la validación se declare una
  sola vez, en la clase del DTO.

Nest corre **sobre** Express (`@nestjs/platform-express`), así que no se
renuncia ni al rendimiento ni al ecosistema de middleware: se agrega estructura
sobre la misma base.

### TypeScript de punta a punta

El beneficio concreto es que **el contrato de la API se verifica en tiempo de
compilación en los dos lados**. Si cambia la forma de una respuesta, el consumo
en el frontend deja de compilar; sin tipos, el mismo cambio se descubre como un
`undefined` en el navegador, en ejecución y solo si alguien recorre esa pantalla.

Además, el compilador es requisito técnico del resto del stack: el sistema de
decoradores de Nest y de TypeORM depende de la emisión de metadatos de tipos, que
solo existe compilando TypeScript.

### TypeORM

- **El esquema es código.** Las entidades declaran tablas, tipos, longitudes,
  índices y relaciones. La estructura de la base se revisa en el mismo diff que
  la lógica, en vez de ser un estado invisible del servidor que alguien modificó
  con un cliente gráfico.
- **Patrón Data Mapper.** La entidad no arrastra la lógica de persistencia
  encima, a diferencia de Active Record. Eso permite que un controlador pida un
  `Repository<Project>` por inyección y que la entidad quede como una
  declaración de forma, sin comportamiento acoplado a la base.
- **`select: false` a nivel de columna.** En `User.clave`, el hash queda excluido
  de todo `find` que no lo pida explícitamente. La protección es el
  comportamiento por defecto del ORM y no una decisión que haya que repetir en
  cada consulta.
- **Transformers de columna.** PostgreSQL devuelve `numeric` como *string* para
  no perder precisión. La entidad `Project` declara un transformer que convierte
  a `number` al leer, de modo que la conversión ocurre en un solo lugar y no
  dispersa por cada consumidor del campo `monto`.
- **`synchronize` en desarrollo.** Deriva el esquema de las entidades al
  arrancar, lo que elimina el paso manual de creación de tablas al clonar el
  proyecto. Es una elección apropiada para esta etapa; un despliegue real usaría
  migraciones versionadas.

### PostgreSQL

Es el motor que permite mover invariantes al lugar donde **no se pueden violar
desde la aplicación**:

- **`UNIQUE` sobre `correo`.** El registro no consulta antes de insertar: intenta
  insertar y captura el código de error **`23505`**. Esto no es un detalle de
  estilo, es corrección: un patrón "consultar y después insertar" tiene una
  condición de carrera entre ambas operaciones, y dos registros simultáneos con
  el mismo correo pueden pasar los dos. La restricción del motor es atómica y no
  admite esa ventana.
- **Clave foránea con `ON DELETE CASCADE`** en `created_by`. La integridad
  referencial la garantiza el motor: no pueden existir proyectos huérfanos aunque
  la aplicación tenga un error.
- **Tipo `ENUM` nativo** para `estado`. Los valores válidos son parte del
  esquema, no una convención documentada.
- **`NUMERIC(14,2)` para `monto`.** Decimal exacto, no coma flotante binaria.
  `FLOAT` y `DOUBLE` no pueden representar exactamente valores como `0.1`, y los
  errores se acumulan al operar sobre montos. Para cualquier campo de dinero,
  `NUMERIC` es la elección correcta y no una preferencia.
- **DDL transaccional.** A diferencia de otros motores, los cambios de esquema
  ocurren dentro de una transacción: si una sincronización falla a la mitad, no
  queda un esquema parcialmente aplicado.

### bcrypt para las claves

La elección de bcrypt sobre un hash de propósito general —SHA-256, MD5— responde
a que **son herramientas para problemas distintos**. SHA está diseñado para ser
rápido, que es exactamente la propiedad que no se quiere al almacenar
credenciales: la velocidad favorece al atacante que prueba millones de
combinaciones por segundo contra una base filtrada.

bcrypt aporta dos mecanismos específicos:

- **Factor de costo configurable** (`BCRYPT_ROUNDS`, aquí 10). El trabajo es
  exponencial en ese parámetro, así que el algoritmo se puede encarecer a medida
  que el hardware mejora, sin cambiar de tecnología.
- **Salt único por hash, embebido en el resultado.** El formato
  `$2b$10$<salt><hash>` guarda el costo y la sal junto al digest. Dos usuarios
  con la misma clave producen hashes distintos, lo que anula las tablas
  precalculadas, y no hace falta una columna aparte para la sal.

### JWT para la sesión

El frontend es una SPA servida desde un origen distinto al de la API. Un JWT
firmado permite **verificar la sesión sin estado compartido**: la API valida la
firma con su secreto y no necesita consultar un almacén de sesiones en cada
petición. Eso elimina un componente de infraestructura y hace que la API sea
horizontalmente escalable por construcción.

### class-validator y `ValidationPipe`

La validación se declara una vez, en el DTO, y se aplica de forma global. Dos
opciones concretas hacen el trabajo pesado:

- **`whitelist: true`** descarta cualquier propiedad no declarada en el DTO. Esto
  previene *mass assignment*: aunque el cuerpo de la petición traiga campos de
  más, no llegan a la entidad.
- **`forbidNonWhitelisted: true`** además rechaza esas peticiones con `400` en
  vez de ignorarlas en silencio, así un cliente mal construido falla de forma
  ruidosa y temprana.

### React con Vite

Vite sirve los módulos como **ESM nativo** en desarrollo, sin empaquetar todo el
árbol en cada cambio, y pre-empaqueta las dependencias con esbuild. El resultado
práctico es arranque en frío por debajo del segundo y recarga en caliente
inmediata.

El `server.proxy` de Vite reenvía `/api` al backend, de modo que en desarrollo el
navegador ve **un solo origen**. Eso elimina las peticiones *preflight* de CORS
del circuito de trabajo y hace que las rutas relativas del cliente funcionen sin
configuración distinta entre desarrollo y producción.

### Bootstrap

Aporta componentes ya construidos y **accesibles**: manejo de foco, roles ARIA y
contraste resueltos por la librería. Escribir esos mismos componentes a mano no
es solo más lento, es más propenso a producir formularios que un lector de
pantalla no puede recorrer. Como se consume compilado desde npm, tampoco agrega
un paso de compilación de estilos al proyecto.

### Docker para la base de datos

Es la pieza que garantiza que **la base sea idéntica en cualquier máquina**, y en
este proyecto se justificó en la práctica.

- **Versión fijada.** `postgres:16-alpine` clava el motor. No depende de qué
  versión tenga instalada quien clone el repositorio, y evita diferencias de
  comportamiento entre versiones mayores.
- **Las credenciales que exige el enunciado, declaradas en el compose.** La base
  `desarrollo_software_1`, el usuario `root` y su clave se crean al primer
  arranque del contenedor. Reproducir eso sobre un PostgreSQL instalado en el
  sistema exige crear el rol y la base a mano, con los permisos correctos.
- **Aislamiento del entorno del anfitrión.** Este proyecto se encontró con **tres
  PostgreSQL compitiendo por el puerto 5432** —uno de Postgres.app, uno de
  Homebrew levantado por un LaunchAgent, y el contenedor—. En macOS, un socket
  ligado a una dirección específica gana sobre uno ligado a comodín, así que las
  conexiones a `localhost` llegaban a un motor distinto del previsto, con un
  esquema distinto. El contenedor elimina esa clase de ambigüedad.
- **Persistencia en volumen nombrado.** `pgdata` sobrevive a reinicios y
  recreaciones del contenedor. Durante el desarrollo, un clúster de Postgres
  instalado en el sistema se reinicializó y se llevó el rol y los datos; el
  volumen de Docker no tiene ese modo de falla.
- **Healthcheck declarado.** `pg_isready` marca el contenedor como *healthy*
  recién cuando la base acepta conexiones, lo que da una señal confiable de
  cuándo es seguro arrancar la API, en lugar de esperar una cantidad arbitraria
  de segundos.
- **Un comando para levantar y otro para descartar.** `docker compose up -d`
  reproduce el entorno; `docker compose down -v` lo borra por completo. Poder
  volver a un estado limpio y conocido hace que los problemas sean
  reproducibles.

La base de datos se contiene, pero **la API y el frontend se ejecutan en el
anfitrión**. Contenerizarlos también agregaría reconstrucción de imágenes y
montaje de volúmenes al ciclo de edición, a cambio de un aislamiento que en este
proyecto no hace falta: es donde el costo de la herramienta superaría su
beneficio.

## Por qué esta arquitectura, y por qué no hexagonal

**La aplicación tiene sólo dos dominios —usuarios y proyectos—, y con ese tamaño
una arquitectura hexagonal no la haría más mantenible.**

Vale la pena explicar el razonamiento, porque la conclusión suele leerse como un
atajo y no lo es.

La arquitectura hexagonal, o de puertos y adaptadores, resuelve problemas
reales, pero problemas específicos: aislar la lógica de negocio cuando hay que
poder cambiar la infraestructura sin tocarla, sostener varios mecanismos de
entrada o de persistencia en paralelo, permitir que un equipo grande trabaje
sobre capas separadas sin pisarse, o proteger reglas de negocio complejas de los
vaivenes de un framework a lo largo de años.

Nada de eso describe este proyecto. Hay **una** base de datos y no está previsto
que haya otra. Hay **un** mecanismo de entrega, que es HTTP. La lógica de negocio
se reduce a cifrar y verificar credenciales, emitir y validar un JWT, y hacer
altas, bajas, modificaciones y consultas acotadas por propietario.

Aplicar el patrón igual tendría un costo concreto y verificable:

- Interfaces con **una sola implementación**, que no abstraen nada porque no hay
  una segunda opción de la cual abstraerse.
- **Mappers** entre la entidad de dominio y la de persistencia, que serían
  copias campo a campo.
- **Casos de uso** envolviendo una única llamada al repositorio, agregando un
  salto de archivo entre la ruta y la consulta.

El resultado no sería un sistema más mantenible sino más código para leer, sin
comportamiento adicional. Y conviene ser preciso con qué significa mantenible:
es **cuánto tarda alguien en entender el sistema y cambiarlo sin romperlo**. Con
dos dominios, tres carpetas de indirección no aceleran ese trabajo, lo demoran.
La complejidad estructural sólo se paga cuando compra algo; acá no compraría
nada.

Por eso la organización es **por feature**, con las capas mínimas que el problema
justifica: la ruta valida en el borde, y si hay lógica no trivial la delega en
una función de negocio; si no la hay, habla directamente con el ORM. Por eso
`ProjectsController` usa el repositorio de TypeORM sin intermediarios —es CRUD
puro— mientras que `UsersService` sí existe, porque verificar la clave actual,
volver a cifrarla y manejar el correo duplicado sí es lógica que merece vivir
aparte del transporte HTTP.

Conviene aclarar algo que suele confundirse: **SOLID no exige arquitectura
hexagonal**. SOLID habla de responsabilidades acotadas y de la dirección de las
dependencias, y ambas cosas se cumplen acá mediante el contenedor de inyección
de NestJS, sin necesidad de una capa de puertos. La sección
[SOLID aplicado](#solid-aplicado) detalla dónde se ve cada principio.

### Cuándo habría que reconsiderarlo

Esta decisión está atada al tamaño actual, así que corresponde dejar escrito qué
la invalidaría:

- Que aparezca un **tercer o cuarto dominio** con reglas que crucen entre sí.
- Que haga falta un **segundo backend de datos** —una caché, un servicio externo,
  un motor de búsqueda— y con él una razón real para abstraer la persistencia.
- Que la lógica de negocio **exceda lo que entra cómodo en un handler** y empiece
  a repetirse entre features.
- Que el proyecto pase a ser mantenido por **varias personas en paralelo** sobre
  las mismas áreas.

Mientras tanto, la organización por feature deja abierto el camino: como cada
dominio ya vive aislado en su carpeta, introducir capas adicionales el día que
se justifique es un cambio contenido en esa carpeta y no una reescritura del
proyecto.

## Estructura

Organización **por feature**, no por tipo técnico. Cada carpeta contiene todo lo
suyo: entidad, DTOs, controlador y, sólo si hay lógica no trivial, un service.

```
eva02/
├── docker-compose.yml          # PostgreSQL con las credenciales de la evaluación
├── api/
│   ├── .env                    # Variables de entorno (único lugar de config)
│   ├── smoke-test.mjs          # Verificación end-to-end
│   └── src/
│       ├── config.ts           # Un solo archivo de configuración
│       ├── app.module.ts
│       ├── main.ts
│       ├── users/
│       │   ├── user.entity.ts
│       │   ├── user.dto.ts
│       │   ├── users.controller.ts  # Edición del perfil propio
│       │   ├── users.service.ts     # Verifica la clave actual y la recifra
│       │   └── users.module.ts
│       ├── auth/
│       │   ├── auth.controller.ts   # Rutas: register, login, me
│       │   ├── auth.service.ts      # Hash, verificación, emisión de JWT
│       │   ├── auth.dto.ts          # Validación de input
│       │   ├── jwt-auth.guard.ts    # Middleware de autenticación
│       │   └── auth.module.ts
│       └── projects/
│           ├── project.entity.ts
│           ├── project.dto.ts
│           ├── projects.controller.ts  # Usa el repositorio del ORM directo
│           └── projects.module.ts
└── web/
    └── src/
        ├── api.ts              # Cliente HTTP + manejo del token
        ├── App.tsx             # Rutas y protección de rutas
        ├── auth/
        │   ├── useAuth.tsx     # Estado de sesión
        │   ├── Login.tsx       # Vista de Inicio de Sesión
        │   ├── Register.tsx    # Vista de Registro
        │   └── Profile.tsx     # Vista de edición de perfil
        └── projects/
            └── Projects.tsx    # Listado, alta y edición, protegido por JWT
```

### Decisiones concretas

Resumen puntual de cómo se aplica el razonamiento de
[Por qué esta arquitectura](#por-qué-esta-arquitectura-y-por-qué-no-hexagonal):

- **Sin capa `repository` propia.** Hay un solo backend de datos, así que los
  handlers usan el `Repository<T>` de TypeORM directamente. Una interfaz con una
  sola implementación no aporta nada.
- **Sin service donde no hay lógica.** `ProjectsController` es CRUD puro y habla
  con el ORM. `AuthService` sí existe porque hashear, comparar y firmar tokens es
  lógica de negocio real y reusable.
- **Validación en un solo lugar.** Los DTOs con `class-validator` validan en el
  borde vía `ValidationPipe` global. Nada revalida río abajo.
- **Una sola configuración.** Todo lo que depende del entorno vive en
  `api/src/config.ts`, sin factories.

### SOLID aplicado

- **SRP** — cada módulo cubre un dominio; el guard sólo autentica, el service sólo
  maneja credenciales, el controlador sólo traduce HTTP.
- **OCP** — agregar un feature es agregar una carpeta y un módulo, sin tocar los
  existentes.
- **LSP** — `JwtAuthGuard` cumple el contrato `CanActivate` y es intercambiable
  por cualquier otro guard de Nest.
- **ISP** — los DTOs exponen sólo los campos que cada operación necesita; el
  `AuthResult` nunca incluye la clave.
- **DIP** — los controladores reciben sus dependencias por el contenedor de Nest,
  no las construyen.

## Puesta en marcha

### 1. Base de datos

Con Docker:

```bash
docker compose up -d
```

O con un PostgreSQL local ya instalado:

```bash
psql -d postgres -c "CREATE ROLE root LOGIN PASSWORD 'desarrollo_software_1' CREATEDB;"
psql -d postgres -c "CREATE DATABASE desarrollo_software_1 OWNER root;"
```

### 2. API

Creá el archivo `api/.env` con el contenido de la sección
[Variables de entorno](#variables-de-entorno-apienv) y luego:

```bash
cd api
npm install
npm start          # http://localhost:3001/api
```

TypeORM crea las tablas al arrancar (`DB_SYNCHRONIZE=true`).

### 3. Frontend

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

## Variables de entorno (`api/.env`)

```
PORT=3001
CORS_ORIGIN=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=root
DB_PASSWORD=desarrollo_software_1
DB_DATABASE=desarrollo_software_1
DB_SYNCHRONIZE=true

JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=1d
BCRYPT_ROUNDS=10
```

## Modelos

### `usuarios`

| Campo        | Tipo           | Notas                          |
| ------------ | -------------- | ------------------------------ |
| `id`         | serial PK      |                                |
| `nombre`     | varchar(120)   |                                |
| `correo`     | varchar(180)   | **UNIQUE** — identificador     |
| `clave`      | varchar(60)    | hash bcrypt, `select: false`   |
| `created_at` | timestamp      |                                |

### `proyectos`

| Campo          | Tipo            | Notas                            |
| -------------- | --------------- | -------------------------------- |
| `id`           | serial PK       |                                  |
| `nombre`       | varchar(150)    |                                  |
| `fecha_inicio` | date            |                                  |
| `estado`       | enum            | pendiente / en_progreso / completado / cancelado |
| `responsable`  | varchar(120)    |                                  |
| `monto`        | numeric(14,2)   |                                  |
| `created_by`   | integer FK      | → `usuarios.id`, ON DELETE CASCADE |
| `created_at`   | timestamp       |                                  |

## Endpoints

| Método   | Ruta                 | Auth | Descripción                          |
| -------- | -------------------- | ---- | ------------------------------------ |
| `POST`   | `/api/auth/register` | —    | Registro; cifra la clave y emite JWT |
| `POST`   | `/api/auth/login`    | —    | Devuelve JWT si las credenciales son válidas |
| `GET`    | `/api/auth/me`       | JWT  | Usuario de la sesión actual          |
| `PATCH`  | `/api/users/me`      | JWT  | Edita nombre, correo y clave propios |
| `GET`    | `/api/projects`      | JWT  | Proyectos del usuario autenticado    |
| `POST`   | `/api/projects`      | JWT  | Crea un proyecto                     |
| `PATCH`  | `/api/projects/:id`  | JWT  | Edita un proyecto propio             |
| `DELETE` | `/api/projects/:id`  | JWT  | Elimina un proyecto propio           |

## Seguridad

- **Cifrado de clave**: bcrypt con 10 rondas. La clave en texto plano nunca se
  guarda ni se devuelve; la columna tiene `select: false` para que no salga por
  accidente en un `find()`.
- **JWT**: firmado con `JWT_SECRET`, expira en 1 día. `JwtAuthGuard` valida el
  header `Authorization: Bearer <token>` y adjunta el usuario al request.
- **Login de tiempo constante**: si el correo no existe se compara igual contra un
  hash dummy, para no filtrar qué correos están registrados.
- **Correo único a nivel de base**: el registro confía en la restricción UNIQUE en
  vez de un "consultar y después insertar", que tiene condición de carrera.
- **Aislamiento por dueño**: listar, editar y eliminar proyectos filtran por
  `created_by`, así un usuario no puede tocar los de otro.
- **Edición del perfil acotada a uno mismo**: `PATCH /api/users/me` toma el id del
  token verificado, no de la URL, así que no hay forma de apuntar a otra cuenta.
- **Cambio de clave con reautenticación**: para cambiarla hay que enviar la
  actual. Un token robado por sí solo no alcanza para secuestrar la cuenta.

## Verificación

Con la API corriendo:

```bash
cd api
npm test
```

Cubre: registro, hash bcrypt real en la base, correo duplicado (409), login
correcto e incorrecto, rechazo sin token y con token inválido, validación de
input (400), creación, listado y edición parcial de proyectos, aislamiento entre
usuarios, edición del perfil, y cambio de clave con verificación de la actual
(incluyendo que la clave vieja deje de servir y que la nueva quede cifrada).
