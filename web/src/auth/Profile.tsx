import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth, type AuthUser } from './useAuth';

const MIN_PASSWORD_LENGTH = 8;

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    nombre: user?.nombre ?? '',
    correo: user?.correo ?? '',
    claveActual: '',
    claveNueva: '',
  });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSaved(false);
    setSubmitting(true);

    // Only send what changed; an empty password field means "leave it alone".
    const body: Record<string, string> = {};
    if (form.nombre !== user?.nombre) body.nombre = form.nombre;
    if (form.correo !== user?.correo) body.correo = form.correo;
    if (form.claveNueva) {
      body.claveNueva = form.claveNueva;
      body.claveActual = form.claveActual;
    }

    try {
      if (Object.keys(body).length > 0) {
        const updated = await api<AuthUser>('/users/me', { method: 'PATCH', body });
        setUser(updated);
      }
      setForm({ ...form, claveActual: '', claveNueva: '' });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="card shadow-sm mt-5">
        <div className="card-body p-4">
          <h1 className="h4 mb-1">Mi perfil</h1>
          <p className="text-body-secondary small mb-4">
            Actualizá tus datos de cuenta.
          </p>

          {error && (
            <div className="alert alert-danger py-2" role="alert">
              {error}
            </div>
          )}
          {saved && (
            <div className="alert alert-success py-2" role="status">
              Cambios guardados.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="nombre" className="form-label">
                Nombre
              </label>
              <input
                id="nombre"
                className="form-control"
                autoComplete="name"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>

            <div className="mb-4">
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

            <fieldset className="border-top pt-3 mb-4">
              <legend className="h6 fs-6 text-body-secondary">
                Cambiar clave
              </legend>
              <p className="form-text mt-0 mb-3">
                Dejá estos campos vacíos si no querés cambiarla.
              </p>

              <div className="mb-3">
                <label htmlFor="claveActual" className="form-label">
                  Clave actual
                </label>
                <input
                  id="claveActual"
                  type="password"
                  className="form-control"
                  autoComplete="current-password"
                  required={form.claveNueva.length > 0}
                  value={form.claveActual}
                  onChange={(e) =>
                    setForm({ ...form, claveActual: e.target.value })
                  }
                />
              </div>

              <div>
                <label htmlFor="claveNueva" className="form-label">
                  Clave nueva
                </label>
                <input
                  id="claveNueva"
                  type="password"
                  className="form-control"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  aria-describedby="clave-help"
                  value={form.claveNueva}
                  onChange={(e) =>
                    setForm({ ...form, claveNueva: e.target.value })
                  }
                />
                <div id="clave-help" className="form-text">
                  Mínimo {MIN_PASSWORD_LENGTH} caracteres.
                </div>
              </div>
            </fieldset>

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={submitting}
            >
              {submitting ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>

          <p className="text-center small mt-3 mb-0">
            <Link to="/proyectos">Volver a proyectos</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
