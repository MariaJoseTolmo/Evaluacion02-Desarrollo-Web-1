import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ correo: '', clave: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form);
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
          <h1 className="h4 mb-1">Iniciar sesión</h1>
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
                autoComplete="current-password"
                required
                value={form.clave}
                onChange={(e) => setForm({ ...form, clave: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={submitting}
            >
              {submitting ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <p className="text-center small mt-3 mb-0">
            ¿No tenés cuenta? <Link to="/registro">Registrate</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
