import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, token } from '../api';

export type AuthUser = { id: number; nombre: string; correo: string };
type Credentials = { correo: string; clave: string };
type AuthResult = { access_token: string; user: AuthUser };

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: Credentials) => Promise<void>;
  register: (input: Credentials & { nombre: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Validate any stored token once on boot so a stale one logs the user out.
  useEffect(() => {
    if (!token.get()) {
      setLoading(false);
      return;
    }
    api<AuthUser>('/auth/me')
      .then(setUser)
      .catch(() => token.clear())
      .finally(() => setLoading(false));
  }, []);

  const authenticate = useCallback(async (path: string, body: unknown) => {
    const result = await api<AuthResult>(path, { method: 'POST', body });
    token.set(result.access_token);
    setUser(result.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: (credentials) => authenticate('/auth/login', credentials),
      register: (input) => authenticate('/auth/register', input),
      logout: () => {
        token.clear();
        setUser(null);
      },
    }),
    [user, loading, authenticate],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
