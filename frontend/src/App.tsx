import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import './App.css';

type LoginResponse = {
  id: string;
  email: string;
  role: 'student' | 'admin';
};

const normalizePath = (path: string) => {
  if (path === '/topics' || path === '/admin') return path;
  return '/login';
};

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [route, setRoute] = useState(() => {
    if (typeof window === 'undefined') return '/login';
    return normalizePath(window.location.pathname);
  });

  const heading = useMemo(() => {
    if (route === '/topics') return 'Student Topics';
    if (route === '/admin') return 'Admin Dashboard';
    return 'Login';
  }, [route]);

  const navigate = (next: '/topics' | '/admin' | '/login') => {
    window.history.pushState({}, '', next);
    setRoute(next);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as LoginResponse | { message?: string };
      if (!response.ok) {
        setError((payload as { message?: string }).message || 'Login failed');
        return;
      }

      if ((payload as LoginResponse).role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/topics');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (route === '/topics' || route === '/admin') {
    return (
      <main className="shell">
        <h1>{heading}</h1>
        <button type="button" onClick={() => navigate('/login')}>
          Back to Login
        </button>
      </main>
    );
  }

  return (
    <main className="shell">
      <h1>{heading}</h1>
      <form className="login-form" onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

export default App;
