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
│       │   └── user.entity.ts
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
        │   └── Register.tsx    # Vista de Registro
        └── projects/
            └── Projects.tsx    # Vista protegida por JWT
```

### Decisiones de arquitectura

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

```bash
cd api
cp .env.example .env
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
| `GET`    | `/api/projects`      | JWT  | Proyectos del usuario autenticado    |
| `POST`   | `/api/projects`      | JWT  | Crea un proyecto                     |
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
- **Aislamiento por dueño**: listar y eliminar proyectos filtran por `created_by`,
  así un usuario no puede tocar los de otro.

## Verificación

Con la API corriendo:

```bash
cd api
npm test
```

Cubre: registro, hash bcrypt real en la base, correo duplicado (409), login
correcto e incorrecto, rechazo sin token y con token inválido, validación de
input (400), creación y listado de proyectos, y aislamiento entre usuarios.
