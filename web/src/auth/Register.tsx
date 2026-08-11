import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

const MIN_PASSWORD_LENGTH = 8;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre: '', correo: '', clave: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form);
      navigate('/proyectos');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card shadow-sm mt-5">
        <div className="card-body p-4">
          <h1 className="h4 mb-1">Crear cuenta</h1>
          <p className="text-body-secondary small mb-4">
            Tech Solutions — Gestión de Proyectos
          </p>

          {error && (
            <div className="alert alert-danger py-2" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="nombre" className="form-label">
                Nombre
              </label>
              <input
                id="nombre"
                type="text"
                className="form-control"
                autoComplete="name"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>

            <div className="mb-3">
              <label htmlFor="correo" className="form-label">
                Correo
              </label>
              <input
                id="correo"
                type="email"
                className="form-control"
                autoComplete="email"
                required
                value={form.correo}
                onChange={(e) => setForm({ ...form, correo: e.target.value })}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="clave" className="form-label">
                Clave
              </label>
              <input
                id="clave"
                type="password"
                className="form-control"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                aria-describedby="clave-help"
                value={form.clave}
                onChange={(e) => setForm({ ...form, clave: e.target.value })}
              />
              <div id="clave-help" className="form-text">
                Mínimo {MIN_PASSWORD_LENGTH} caracteres.
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={submitting}
            >
              {submitting ? 'Creando…' : 'Registrarme'}
            </button>
          </form>

          <p className="text-center small mt-3 mb-0">
            ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
