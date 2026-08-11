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

**La razón principal es que es el stack en el que tengo más experiencia, y eso me
permite revisar el código que emite la IA.**

Esa frase merece desarrollarse, porque no es una preferencia de comodidad sino
una decisión de control de calidad.

Cuando parte del código lo genera una IA, el cuello de botella deja de ser
escribirlo y pasa a ser **validarlo**. Una IA produce código que casi siempre
compila, casi siempre corre y casi siempre parece correcto. El problema son los
casos en que "casi" no alcanza: un `findOne` que devuelve la contraseña porque
nadie recordó que la columna estaba marcada como `select: false`, una
verificación de propietario que se olvidó en el endpoint de edición, un
`ValidationPipe` sin `whitelist` que deja pasar campos que nunca debieron
llegar. Ninguno de esos errores rompe la aplicación. Todos se ven bien en una
lectura superficial.

Detectarlos exige conocer el framework lo suficiente como para distinguir lo
**idiomático** de lo que simplemente **parece plausible**. En un stack que no
domino, no tendría cómo hacer esa distinción: cualquier cosa que arranque sin
errores se vería igual de correcta, y la IA pasaría de ser una herramienta que
dirijo a ser un oráculo que tengo que creer. Elegir tecnologías que conozco
convierte la revisión en algo que efectivamente puedo hacer, y mantiene la
decisión técnica del lado humano.

Sobre esa base, cada pieza aporta algo concreto:

- **NestJS** es opinado. Módulos, inyección de dependencias y decoradores
  imponen una forma de estructurar el código, así que las desviaciones se notan
  al leer. Además, buena parte de los errores de cableado explotan al arrancar
  la aplicación en vez de manifestarse en producción.
- **TypeORM** deja el esquema declarado en las entidades. La estructura de la
  base es código revisable en el mismo diff que el resto, no un estado invisible
  del servidor.
- **PostgreSQL** permite mover reglas a la base: el `UNIQUE` sobre el correo y la
  clave foránea de `created_by` se cumplen aunque la capa de aplicación tenga un
  error. Una restricción declarada en el motor no depende de que alguien se
  acuerde de validarla.
- **TypeScript de punta a punta** hace que un cambio de forma en la API rompa la
  compilación del frontend, en vez de romperse recién en el navegador.
- **Bootstrap** evita escribir CSS desde cero. La rúbrica evalúa persistencia,
  autenticación y cifrado; el tiempo que no se va en estilos se invierte en lo
  que efectivamente se corrige.

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
