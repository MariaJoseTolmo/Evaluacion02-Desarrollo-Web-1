/**
 * End-to-end smoke test against a running API.
 *   1. npm start        (in another terminal)
 *   2. node smoke-test.mjs
 *
 * Verifies registration hashing, login, JWT issuance, and guard enforcement.
 */
import assert from 'node:assert/strict';
import { Client } from 'pg';

const BASE = process.env.API_URL ?? 'http://localhost:3001/api';
const correo = `smoke.${Date.now()}@techsolutions.cl`;
const clave = 'ClaveSegura123';

const call = async (path, options = {}) => {
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
};

// 1. Register — returns a token and never echoes the password.
const registered = await call('/auth/register', {
  method: 'POST',
  body: { nombre: 'Smoke Test', correo, clave },
});
assert.equal(registered.status, 201, `register: ${JSON.stringify(registered.body)}`);
assert.ok(registered.body.access_token, 'register should return a JWT');
assert.equal(registered.body.user.clave, undefined, 'password must not be returned');

// 2. The stored password is a bcrypt hash, not plain text.
const db = new Client({
  host: 'localhost',
  port: 5432,
  user: 'root',
  password: 'desarrollo_software_1',
  database: 'desarrollo_software_1',
});
await db.connect();
const { rows } = await db.query('SELECT clave FROM usuarios WHERE correo = $1', [correo]);
await db.end();
assert.equal(rows.length, 1, 'user should be persisted');
assert.notEqual(rows[0].clave, clave, 'password must not be stored in plain text');
assert.match(rows[0].clave, /^\$2[aby]\$\d{2}\$/, 'password must be a bcrypt hash');

// 3. Duplicate email is rejected by the unique constraint.
const duplicate = await call('/auth/register', {
  method: 'POST',
  body: { nombre: 'Otro', correo, clave },
});
assert.equal(duplicate.status, 409, 'duplicate email should conflict');

// 4. Login with the right credentials returns a JWT; wrong ones do not.
const login = await call('/auth/login', { method: 'POST', body: { correo, clave } });
assert.equal(login.status, 200, `login: ${JSON.stringify(login.body)}`);
const token = login.body.access_token;
assert.ok(token, 'login should return a JWT');

const badLogin = await call('/auth/login', {
  method: 'POST',
  body: { correo, clave: 'ClaveIncorrecta1' },
});
assert.equal(badLogin.status, 401, 'wrong password should be rejected');

// 5. The JWT guard protects the private routes.
assert.equal((await call('/projects')).status, 401, 'no token should be rejected');
assert.equal(
  (await call('/projects', { token: 'not-a-jwt' })).status,
  401,
  'invalid token should be rejected',
);

// 6. Input validation rejects malformed payloads at the edge.
const invalid = await call('/auth/register', {
  method: 'POST',
  body: { nombre: 'X', correo: 'no-es-correo', clave: '123' },
});
assert.equal(invalid.status, 400, 'invalid input should be rejected');

// 7. An authenticated user can create and read their own projects.
const created = await call('/projects', {
  method: 'POST',
  token,
  body: {
    nombre: 'Migración ERP',
    fechaInicio: '2026-09-01',
    estado: 'en_progreso',
    responsable: 'María José',
    monto: 15750000.5,
  },
});
assert.equal(created.status, 201, `create project: ${JSON.stringify(created.body)}`);
assert.equal(created.body.monto, 15750000.5, 'monto should round-trip as a number');

const list = await call('/projects', { token });
assert.equal(list.status, 200);
assert.equal(list.body.length, 1, 'list should be scoped to the owner');
assert.equal(list.body[0].createdById, login.body.user.id, 'created_by must be the user id');

// 8. The owner can edit a project, patching only the fields sent.
const edited = await call(`/projects/${created.body.id}`, {
  method: 'PATCH',
  token,
  body: { estado: 'completado', monto: 16000000 },
});
assert.equal(edited.status, 200, `edit project: ${JSON.stringify(edited.body)}`);
assert.equal(edited.body.estado, 'completado');
assert.equal(edited.body.monto, 16000000);
assert.equal(edited.body.nombre, 'Migración ERP', 'untouched fields must survive');

assert.equal(
  (await call(`/projects/${created.body.id}`, {
    method: 'PATCH',
    token,
    body: { estado: 'inexistente' },
  })).status,
  400,
  'invalid estado should be rejected',
);

// 9. Another user cannot see, edit or delete those projects.
const other = await call('/auth/register', {
  method: 'POST',
  body: { nombre: 'Intruso', correo: `intruso.${Date.now()}@techsolutions.cl`, clave },
});
const otherToken = other.body.access_token;
assert.equal((await call('/projects', { token: otherToken })).body.length, 0);
assert.equal(
  (await call(`/projects/${created.body.id}`, {
    method: 'PATCH',
    token: otherToken,
    body: { nombre: 'Secuestrado' },
  })).status,
  404,
  'another user must not edit this project',
);
assert.equal(
  (await call(`/projects/${created.body.id}`, { method: 'DELETE', token: otherToken })).status,
  404,
  'another user must not delete this project',
);

// 10. The owner can delete it.
assert.equal(
  (await call(`/projects/${created.body.id}`, { method: 'DELETE', token })).status,
  204,
);

console.log('✅ Todas las verificaciones pasaron.');
