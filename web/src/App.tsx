import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './auth/Login';
import Register from './auth/Register';
import Profile from './auth/Profile';
import Projects from './projects/Projects';
import { useAuth } from './auth/useAuth';

/** Client-side counterpart of the API's JWT guard. */
function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-center mt-5">Cargando…</p>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Register />} />
      <Route
        path="/proyectos"
        element={
          <RequireAuth>
            <Projects />
          </RequireAuth>
        }
      />
      <Route
        path="/perfil"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/proyectos" replace />} />
    </Routes>
  );
}
