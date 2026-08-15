# Tech Solutions — Gestión de Proyectos

Evaluación Sumativa Unidad 2 — Desarrollo de Software Web I.

API REST con **NestJS + TypeORM + PostgreSQL** y SPA con **React + Bootstrap**.

## Stack

| Capa      | Tecnología                                             |
| --------- | ------------------------------------------------------ |
| Backend   | NestJS 11 (sobre Express), TypeScript                  |
| ORM       | TypeORM 0.3                                            |
| Base      | PostgreSQL 16                                          |
| Auth      | JWT (`@nestjs/jwt`) + Argon2id                         |
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

> **En este proyecto** — `api/src/projects/projects.controller.ts:25`
>
> ```ts
> @Controller('projects')
> @UseGuards(JwtAuthGuard)   // cubre todas las rutas de abajo
> ```
>
> Cuando se agregó `@Patch(':id')` para editar proyectos, no hizo falta escribir
> ni una línea de autenticación: el endpoint nació protegido. Con middleware
> montado por ruta, olvidarse no produce un error visible — produce una ruta
> abierta.

### TypeScript de punta a punta

El beneficio concreto es que **el contrato de la API se verifica en tiempo de
compilación en los dos lados**. Si cambia la forma de una respuesta, el consumo
en el frontend deja de compilar; sin tipos, el mismo cambio se descubre como un
`undefined` en el navegador, en ejecución y solo si alguien recorre esa pantalla.

Además, el compilador es requisito técnico del resto del stack: el sistema de
decoradores de Nest y de TypeORM depende de la emisión de metadatos de tipos, que
solo existe compilando TypeScript.

> **En este proyecto** — `web/src/api.ts:19`
>
> ```ts
> export async function api<T>(path: string, …): Promise<T>
> ```
>
> `Profile.tsx` la consume como `api<AuthUser>('/users/me')`. Si la API dejara de
> devolver `nombre`, el frontend **deja de compilar**. Sin tipos, el mismo cambio
> se vería como un "Sesión de undefined" en pantalla, y sólo si alguien entra a
> esa vista.

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

> **En este proyecto** — `api/src/users/user.entity.ts:28`
>
> ```ts
> @Column({ length: 255, select: false })
> clave: string;
> ```
>
> `GET /api/auth/me` hace un `findOne` y devuelve el usuario completo, y aun así
> **nunca filtra el hash**. El único lugar que lo pide es el login, y lo hace de
> forma explícita con `select: { clave: true }`. No hay que acordarse de borrar
> el campo en cada respuesta: no viene.
>
> El otro caso es `api/src/projects/project.entity.ts:45`, donde un `transformer`
> convierte `numeric` a número. Por eso `monto` llega al cliente como `15750000`
> y no como `"15750000.00"`, resuelto **en un solo lugar** en vez de en cada
> consumidor del campo.

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

> **En este proyecto** — `api/src/auth/auth.service.ts:33-42`
>
> ```ts
> await this.users.save(user);          // no consulta antes
> } catch (error) {
>   if (error.code === '23505') throw new ConflictException(…)
> ```
>
> El registro **no pregunta si el correo ya existe**: inserta y atrapa el error
> del motor. Si dos personas se registran con el mismo correo en el mismo
> instante, un "consulto y después inserto" deja pasar a las dos, porque entre la
> consulta y la inserción hay una ventana. La restricción `UNIQUE` no tiene esa
> ventana.

### Argon2id para las claves

Primero, por qué no un hash de propósito general —SHA-256, MD5—: **son
herramientas para problemas distintos**. SHA está diseñado para ser rápido, que
es exactamente la propiedad que no se quiere al almacenar credenciales, porque la
velocidad favorece a quien prueba millones de combinaciones por segundo contra
una base filtrada.

Segundo, por qué Argon2id y no bcrypt, que también es un hash de contraseñas
legítimo. Argon2 **ganó la Password Hashing Competition en 2015** y es la primera
recomendación de OWASP para aplicaciones nuevas. La diferencia técnica que
justifica la elección es que Argon2 es **memory-hard**:

- **bcrypt es caro en CPU pero barato en memoria** (~4 KiB por hash). Eso permite
  que una GPU con miles de núcleos, o un ASIC diseñado a medida, calculen muchos
  hashes en paralelo a un costo muy bajo por unidad.
- **Argon2id exige una cantidad configurable de memoria por hash** —aquí 19 MiB—
  y esa memoria no se puede compartir entre cálculos simultáneos. Paralelizar
  deja de ser barato: mil intentos en paralelo requieren mil veces esa memoria,
  no mil núcleos. Es un límite físico, no algorítmico.
- La variante **id** combina Argon2i y Argon2d, de modo que resiste tanto los
  ataques de canal lateral por tiempo de acceso como los de compromiso
  tiempo-memoria. Es la variante recomendada cuando no hay una razón concreta
  para elegir otra.

Los tres parámetros son configurables (`ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`,
`ARGON2_PARALLELISM`) y sus valores por defecto siguen la línea base de OWASP:
19 MiB, 2 iteraciones, 1 carril. **El costo de memoria es la primera perilla a
subir** a medida que mejora el hardware, porque es la que sostiene la resistencia
al paralelismo.

Como bcrypt, Argon2 genera una **sal única por hash y la embebe en el resultado**,
junto con los parámetros usados:

```
$argon2id$v=19$m=19456,p=1,t=2$/Ud8eO37sPSMJrDan34uQA$ee4yWtEljcipSVL54b3BwCZTE62iLAihg7FUPlENmnQ
```

Dos usuarios con la misma clave producen hashes distintos, lo que anula las
tablas precalculadas, y no hace falta una columna aparte para la sal. Que los
parámetros viajen dentro del hash permite además subirlos en el futuro sin
invalidar los hashes ya existentes: cada uno se verifica con los suyos.

> **En este proyecto** — `api/src/auth/auth.service.ts:30,65`
>
> ```ts
> const dummyHash = argon2.hash('unknown-user', ARGON2_OPTIONS);
> const valid = await argon2.verify(user?.clave ?? (await dummyHash), dto.clave);
> ```
>
> Si el correo no existe, el login compara igual contra un hash descartable. La
> razón es que el costo de Argon2 es medible: si la función saliera antes al no
> encontrar al usuario, **un correo inexistente respondería más rápido que una
> clave incorrecta**, y con un cronómetro se podría averiguar qué correos están
> registrados. Comparar siempre iguala los tiempos —medido: ~40 ms contra ~37 ms—.
>
> Dos detalles propios de Argon2 frente a bcrypt: no tiene API síncrona, así que
> el hash señuelo es una promesa resuelta una vez al arrancar; y `argon2.verify`
> recibe `(hash, claveEnClaro)`, **al revés que `bcrypt.compare`**. Invertir esos
> argumentos hace que todo login falle.

### JWT para la sesión

El frontend es una SPA: el navegador conserva la sesión y la envía en cada
petición. Un JWT firmado permite **verificar esa sesión sin estado compartido**:
la API valida la firma con su secreto y no necesita consultar un almacén de
sesiones. Eso elimina un componente de infraestructura y hace que la API sea
horizontalmente escalable por construcción, porque cualquier instancia puede
atender cualquier petición sin coordinarse con las demás.

> **En este proyecto** — `api/src/auth/jwt-auth.guard.ts:32-35`
>
> ```ts
> const payload = await this.jwt.verifyAsync(token);
> request.user = { id: payload.sub, correo: payload.correo };
> ```
>
> Los controladores filtran por `req.user.id`, que sale del **token verificado y
> nunca de la URL**. Por eso la edición de perfil es `PATCH /api/users/me` y no
> `PATCH /api/users/:id`: no existe un parámetro donde mentir. Lo mismo en
> proyectos, donde listar, editar y borrar filtran por `createdById`.

### class-validator y `ValidationPipe`

La validación se declara una vez, en el DTO, y se aplica de forma global. Dos
opciones concretas hacen el trabajo pesado:

- **`whitelist: true`** descarta cualquier propiedad no declarada en el DTO. Esto
  previene *mass assignment*: aunque el cuerpo de la petición traiga campos de
  más, no llegan a la entidad.
- **`forbidNonWhitelisted: true`** además rechaza esas peticiones con `400` en
  vez de ignorarlas en silencio, así un cliente mal construido falla de forma
  ruidosa y temprana.

> **En este proyecto** — `api/src/users/user.dto.ts:38`
>
> ```ts
> @ValidateIf((dto) => dto.claveNueva !== undefined)
> claveActual?: string;
> ```
>
> `claveActual` es opcional, salvo que se esté cambiando la clave: ahí pasa a ser
> obligatoria. Esa regla condicional queda declarada junto al campo, en lugar de
> ser un `if` perdido dentro del service. Y gracias a `whitelist`, un cuerpo que
> incluya `{"id": 999}` nunca llega a la entidad.

### React con Vite

Vite sirve los módulos como **ESM nativo** en desarrollo, sin empaquetar todo el
árbol en cada cambio, y pre-empaqueta las dependencias con esbuild. El resultado
práctico es arranque en frío por debajo del segundo y recarga en caliente
inmediata.

El `server.proxy` de Vite reenvía `/api` al backend, de modo que en desarrollo el
navegador ve **un solo origen**. Eso elimina las peticiones *preflight* de CORS
del circuito de trabajo y hace que las rutas relativas del cliente funcionen sin
configuración distinta entre desarrollo y producción, donde el mismo rol lo
cumple nginx.

> **En este proyecto** — `web/src/projects/Projects.tsx:73`
>
> ```ts
> if (editingId === null) { …POST } else { …PATCH }
> ```
>
> Un único formulario sirve para crear y editar: el estado decide el verbo HTTP,
> el encabezado (`Nuevo proyecto` / `Editar proyecto`) y la etiqueta del botón
> (`Crear` / `Guardar`). Un modal aparte habría duplicado los cinco campos y sus
> validaciones para obtener el mismo resultado.
>
> Y en `web/Dockerfile:4,15`, Vite existe **sólo durante la compilación**: la
> imagen final es nginx con los estáticos adentro y pesa **48.7 MB**, sin Node ni
> `node_modules`.

### Bootstrap

Aporta componentes ya construidos y **accesibles**: manejo de foco, roles ARIA y
contraste resueltos por la librería. Escribir esos mismos componentes a mano no
es solo más lento, es más propenso a producir formularios que un lector de
pantalla no puede recorrer. Como se consume compilado desde npm, tampoco agrega
un paso de compilación de estilos al proyecto.

> **En este proyecto** — `web/src/auth/Login.tsx:36`
>
> ```tsx
> <div className="alert alert-danger py-2" role="alert">
> ```
>
> Ese `role="alert"` hace que un lector de pantalla **anuncie el error de login
> apenas aparece**, sin que la persona tenga que salir a buscarlo por la página.
> Es exactamente el tipo de detalle que se pierde al escribir la alerta a mano:
> visualmente el resultado sería idéntico y el problema pasaría inadvertido.

### Docker para toda la aplicación

Es la pieza que garantiza que **el sistema completo sea idéntico en cualquier
máquina**. Los tres servicios —base, API y frontend— corren en contenedores, así
que el único requisito para ejecutar el proyecto es tener Docker: no hace falta
instalar Node ni PostgreSQL, ni que coincidan las versiones.

- **Versión fijada en cada capa.** `postgres:16-alpine`, `node:22-alpine` y
  `nginx:1.27-alpine` clavan el motor, el runtime y el servidor web. El
  comportamiento no depende de qué tenga instalado quien clone el repositorio.
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
- **Arranque ordenado por estado real, no por tiempo.** Los `healthcheck` y las
  cláusulas `depends_on: condition: service_healthy` encadenan el arranque: la
  API espera a que `pg_isready` confirme que la base acepta conexiones, y el
  frontend espera a que la API responda. Es la diferencia entre esperar a que un
  servicio **esté listo** y esperar una cantidad arbitraria de segundos con la
  esperanza de que alcance.
- **Un comando para levantar y otro para descartar.** `docker compose up -d`
  reproduce el entorno completo; `docker compose down -v` lo borra. Poder volver
  a un estado limpio y conocido hace que los problemas sean reproducibles.

#### Imágenes multi-etapa

Tanto la API como el frontend se construyen en varias etapas, y eso responde a
un problema concreto: **las herramientas necesarias para compilar no son las
necesarias para ejecutar**.

- En la **API**, la etapa de compilación instala todas las dependencias, incluido
  el compilador de TypeScript, y produce `dist/`. La etapa final parte de una
  imagen limpia, instala sólo dependencias de producción y copia el JavaScript ya
  compilado. El compilador y las devDependencies no viajan en la imagen final.
- Las herramientas de compilación nativa (`python3`, `make`, `g++`) que necesita
  Argon2 en Alpine se instalan, se usan y **se borran en la misma capa**. Si se
  borraran en una capa posterior, seguirían ocupando espacio en la imagen, porque
  las capas son inmutables y acumulativas.
- El contenedor de la API corre como el usuario **`node`**, no como `root`: si
  alguien lograra ejecutar código dentro del contenedor, no tendría privilegios
  administrativos sobre él.
- En el **frontend**, Node sólo existe durante la compilación. La imagen final es
  `nginx:1.27-alpine` con los archivos estáticos adentro — un servidor web y
  HTML, sin Node ni `node_modules` en producción.

#### nginx como servidor y proxy

En desarrollo, Vite resuelve dos cosas que en producción no existen, y nginx las
reemplaza:

- **Proxy de `/api` hacia el contenedor de la API.** El navegador ve un único
  origen, así que no hay peticiones cruzadas ni CORS que configurar. El código
  del cliente usa rutas relativas (`fetch('/api/projects')`) y funciona igual en
  desarrollo y en producción.
- **Fallback de historial para el router.** `try_files $uri $uri/ /index.html`
  hace que entrar directo a `/perfil`, o recargar esa página, devuelva la SPA en
  vez de un 404. React Router resuelve la ruta del lado del cliente, pero en
  disco ese archivo no existe: sin esta regla, la aplicación sólo funcionaría
  entrando por la raíz.

> **En este proyecto** — `web/nginx.conf:24`
>
> ```nginx
> try_files $uri $uri/ /index.html;
> ```
>
> Sin esa línea, entrar directo a <http://localhost:8080/perfil> o recargar esa
> página devuelve **404**. En desarrollo el problema no se ve, porque el servidor
> de Vite ya hace ese fallback; aparece recién al servir el build con un servidor
> web real. Se comprueba con `curl -o /dev/null -w '%{http_code}'
> http://localhost:8080/perfil`, que debe responder `200`.

#### Resolución por nombre de servicio

Dentro de la red de Compose, cada servicio se resuelve por su nombre: la API se
conecta a `db:5432` y nginx reenvía a `api:3001`. Ningún contenedor usa
`localhost` para hablar con otro, porque **cada contenedor tiene su propio
`localhost`**. Esa red interna es también lo que vuelve irrelevante el conflicto
de puertos del anfitrión descrito arriba: el tráfico entre servicios nunca pasa
por el puerto 5432 de la máquina.

> **En este proyecto** — `docker-compose.yml:29,47`
>
> ```yaml
> DB_HOST: db                            # no "localhost"
> depends_on:
>   db: { condition: service_healthy }   # espera a que ACEPTE conexiones
> ```
>
> Durante el desarrollo, el PostgreSQL de Homebrew arrancó solo —vía LaunchAgent—
> y volvió a tomar el puerto 5432 del anfitrión, rompiendo la verificación que
> corría desde afuera. A los servicios del stack no les afectó en absoluto: se
> hablan por la red interna. Esa es la diferencia práctica entre depender del
> entorno de la máquina y no depender de él.

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
├── docker-compose.yml          # Orquesta los tres servicios: db, api, web
├── api/
│   ├── Dockerfile              # Multi-etapa: compila TS, ejecuta sólo dist/
│   ├── .env                    # Variables de entorno (sólo para uso sin Docker)
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
    ├── Dockerfile              # Multi-etapa: compila con Vite, sirve con nginx
    ├── nginx.conf              # Proxy a la API + fallback del router
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

### Con Docker (recomendado)

La aplicación completa —base de datos, API y frontend— corre en contenedores. Es
el único requisito tener Docker instalado: no hace falta Node, ni PostgreSQL, ni
crear archivos `.env`.

```bash
docker compose up -d --build
```

| Servicio | URL                              | Contenedor  |
| -------- | -------------------------------- | ----------- |
| Frontend | <http://localhost:8080>          | `eva02_web` |
| API      | <http://localhost:8080/api>      | `eva02_api` |
| Base     | `localhost:5432`                 | `eva02_db`  |

Los servicios arrancan encadenados por *healthcheck*: la API espera a que la base
acepte conexiones y el frontend espera a que la API responda, así que cuando el
comando termina el sistema está listo. TypeORM crea las tablas al arrancar
(`DB_SYNCHRONIZE=true`).

Verificar el despliegue:

```bash
docker compose exec api node smoke-test.mjs
```

Otros comandos útiles:

```bash
docker compose logs -f api     # seguir los logs de la API
docker compose ps              # estado y salud de cada servicio
docker compose down            # detener, conservando los datos
docker compose down -v         # detener y borrar también la base
```

### Sin Docker (desarrollo local)

Útil para trabajar con recarga en caliente. Requiere Node 22 y un PostgreSQL
propio.

```bash
# 1. Base de datos: crear rol y base con las credenciales del enunciado
psql -d postgres -c "CREATE ROLE root LOGIN PASSWORD 'desarrollo_software_1' CREATEDB;"
psql -d postgres -c "CREATE DATABASE desarrollo_software_1 OWNER root;"

# 2. API — crear api/.env con la sección Variables de entorno
cd api && npm install && npm run dev    # http://localhost:3001/api

# 3. Frontend
cd web && npm install && npm run dev    # http://localhost:5173
```

> **Atención con el puerto 5432.** Si el sistema ya tiene un PostgreSQL propio
> —Postgres.app, Homebrew— va a competir con el contenedor por ese puerto. En
> macOS gana el que se liga a una dirección específica sobre el que usa comodín,
> así que las conexiones a `localhost` pueden terminar en un motor distinto del
> esperado. Se comprueba con `lsof -nP -iTCP:5432 -sTCP:LISTEN`; con el stack en
> Docker el problema no existe, porque los contenedores se comunican por la red
> interna de Compose.

## Variables de entorno (`api/.env`)

Con Docker **no hace falta crear este archivo**: los valores están declarados en
el servicio `api` de `docker-compose.yml`, con `DB_HOST: db` para resolver la
base por el nombre del servicio dentro de la red de Compose.

El bloque siguiente corresponde a la ejecución local sin contenedores:

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
ARGON2_MEMORY_COST=19456
ARGON2_TIME_COST=2
ARGON2_PARALLELISM=1
```

## Modelos

### `usuarios`

| Campo        | Tipo           | Notas                          |
| ------------ | -------------- | ------------------------------ |
| `id`         | serial PK      |                                |
| `nombre`     | varchar(120)   |                                |
| `correo`     | varchar(180)   | **UNIQUE** — identificador     |
| `clave`      | varchar(255)   | hash Argon2id, `select: false` |
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

- **Cifrado de clave**: Argon2id con 19 MiB de memoria, 2 iteraciones y 1 carril
  —la línea base de OWASP—. Es *memory-hard*, así que resiste el crackeo por GPU
  mucho mejor que un algoritmo que sólo cuesta CPU. La clave en texto plano nunca
  se guarda ni se devuelve; la columna tiene `select: false` para que no salga
  por accidente en un `find()`.
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

Con el stack en Docker:

```bash
docker compose exec api node smoke-test.mjs
```

Sin Docker, con la API corriendo localmente:

```bash
cd api && npm test
```

El test lee la configuración de la base de las mismas variables de entorno que
usa la API, de modo que siempre inspecciona **la base a la que la API escribió**
y no otra que pueda estar escuchando en el mismo puerto.

Cubre: registro, hash Argon2id real en la base, correo duplicado (409), login
correcto e incorrecto, rechazo sin token y con token inválido, validación de
input (400), creación, listado y edición parcial de proyectos, aislamiento entre
usuarios, edición del perfil, y cambio de clave con verificación de la actual
(incluyendo que la clave vieja deje de servir y que la nueva quede cifrada).
