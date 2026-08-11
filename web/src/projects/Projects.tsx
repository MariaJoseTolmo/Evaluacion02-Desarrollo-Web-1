import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/useAuth';

type Project = {
  id: number;
  nombre: string;
  fechaInicio: string;
  estado: string;
  responsable: string;
  monto: number;
};

const ESTADOS = ['pendiente', 'en_progreso', 'completado', 'cancelado'];

const BADGE: Record<string, string> = {
  pendiente: 'secondary',
  en_progreso: 'primary',
  completado: 'success',
  cancelado: 'danger',
};

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const emptyForm = {
  nombre: '',
  fechaInicio: new Date().toISOString().slice(0, 10),
  estado: 'pendiente',
  responsable: '',
  monto: '',
};

export default function Projects() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Project[]>('/projects')
      .then(setProjects)
      .catch((err) => setError((err as Error).message));
  }, []);

  function startEdit(project: Project) {
    setEditingId(project.id);
    setForm({
      nombre: project.nombre,
      fechaInicio: project.fechaInicio,
      estado: project.estado,
      responsable: project.responsable,
      monto: String(project.monto),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  /** One form serves both create and edit; `editingId` picks the verb. */
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const body = { ...form, monto: Number(form.monto) };
    try {
      if (editingId === null) {
        const created = await api<Project>('/projects', { method: 'POST', body });
        setProjects([created, ...projects]);
      } else {
        const updated = await api<Project>(`/projects/${editingId}`, {
          method: 'PATCH',
          body,
        });
        setProjects(projects.map((p) => (p.id === editingId ? updated : p)));
      }
      cancelEdit();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(id: number) {
    setError('');
    try {
      await api<void>(`/projects/${id}`, { method: 'DELETE' });
      setProjects(projects.filter((p) => p.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="container py-4">
      <header className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h4 mb-0">Proyectos</h1>
          <small className="text-body-secondary">
            Sesión de {user?.nombre}
          </small>
        </div>
        <div className="d-flex gap-2">
          <Link to="/perfil" className="btn btn-outline-primary btn-sm">
            Mi perfil
          </Link>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={logout}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {error && (
        <div className="alert alert-danger py-2" role="alert">
          {error}
        </div>
      )}

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h6 mb-3">
            {editingId === null ? 'Nuevo proyecto' : 'Editar proyecto'}
          </h2>
          <form className="row g-2 align-items-end" onSubmit={handleSubmit}>
            <div className="col-12 col-md-3">
              <label htmlFor="p-nombre" className="form-label small">
                Nombre
              </label>
              <input
                id="p-nombre"
                className="form-control"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div className="col-6 col-md-2">
              <label htmlFor="p-fecha" className="form-label small">
                Fecha de inicio
              </label>
              <input
                id="p-fecha"
                type="date"
                className="form-control"
                required
                value={form.fechaInicio}
                onChange={(e) =>
                  setForm({ ...form, fechaInicio: e.target.value })
                }
              />
            </div>
            <div className="col-6 col-md-2">
              <label htmlFor="p-estado" className="form-label small">
                Estado
              </label>
              <select
                id="p-estado"
                className="form-select"
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                {ESTADOS.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label htmlFor="p-responsable" className="form-label small">
                Responsable
              </label>
              <input
                id="p-responsable"
                className="form-control"
                required
                value={form.responsable}
                onChange={(e) =>
                  setForm({ ...form, responsable: e.target.value })
                }
              />
            </div>
            <div className="col-6 col-md-2">
              <label htmlFor="p-monto" className="form-label small">
                Monto
              </label>
              <input
                id="p-monto"
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                required
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
              />
            </div>
            <div className="col-12 col-md-1 d-grid gap-1">
              <button className="btn btn-primary" type="submit">
                {editingId === null ? 'Crear' : 'Guardar'}
              </button>
              {editingId !== null && (
                <button
                  className="btn btn-link btn-sm p-0"
                  type="button"
                  onClick={cancelEdit}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Fecha de inicio</th>
              <th scope="col">Estado</th>
              <th scope="col">Responsable</th>
              <th scope="col" className="text-end">
                Monto
              </th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-body-secondary py-4">
                  Todavía no hay proyectos.
                </td>
              </tr>
            )}
            {projects.map((project) => (
              <tr key={project.id}>
                <td>{project.nombre}</td>
                <td>{project.fechaInicio}</td>
                <td>
                  <span className={`badge text-bg-${BADGE[project.estado]}`}>
                    {project.estado.replace('_', ' ')}
                  </span>
                </td>
                <td>{project.responsable}</td>
                <td className="text-end">{money.format(project.monto)}</td>
                <td className="text-end">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary me-1"
                    onClick={() => startEdit(project)}
                    aria-label={`Editar ${project.nombre}`}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleDelete(project.id)}
                    aria-label={`Eliminar ${project.nombre}`}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
