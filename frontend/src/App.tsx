import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { addStudentToList, removeStudentFromList, type StudentRow } from './adminStudents';
import './App.css';

type LoginResponse = {
  id: string;
  email: string;
  role: 'student' | 'admin';
};

type CreateStudentResponse = {
  id: string;
  name: string;
  email: string;
  newPassword: string;
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

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState('');
  const [createError, setCreateError] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');

  const heading = useMemo(() => {
    if (route === '/topics') return 'Student Topics';
    if (route === '/admin') return 'Admin Dashboard';
    return 'Login';
  }, [route]);

  const navigate = (next: '/topics' | '/admin' | '/login') => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', next);
    }
    setRoute(next);
  };

  const loadStudents = async () => {
    setStudentsLoading(true);
    setStudentsError('');

    try {
      const response = await fetch('/admin/users', {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        setStudentsError('Failed to load students');
        return;
      }

      const payload = (await response.json()) as StudentRow[];
      setStudents(payload);
    } catch {
      setStudentsError('Failed to load students');
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    if (route === '/admin') {
      void loadStudents();
    }
  }, [route]);

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

  const onLogout = async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      navigate('/login');
    }
  };

  const onCreateStudent = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError('');
    setCreatePassword('');

    try {
      const response = await fetch('/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: newStudentName, email: newStudentEmail }),
      });

      const payload = (await response.json()) as CreateStudentResponse | { message?: string };
      if (!response.ok) {
        setCreateError((payload as { message?: string }).message || 'Failed to create student');
        return;
      }

      const created = payload as CreateStudentResponse;
      setStudents((prev) =>
        addStudentToList(prev, {
          id: created.id,
          name: created.name,
          email: created.email,
          hasSelectedTopic: false,
        }),
      );
      setCreatePassword(created.newPassword);
      setNewStudentName('');
      setNewStudentEmail('');
    } catch {
      setCreateError('Failed to create student');
    }
  };

  const onDeleteStudent = async (studentId: string) => {
    setCreateError('');

    try {
      const response = await fetch(`/admin/users/${studentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.status === 204) {
        setStudents((prev) => removeStudentFromList(prev, studentId));
        return;
      }

      if (response.status === 404) {
        setCreateError('Student not found');
        return;
      }

      setCreateError('Failed to delete student');
    } catch {
      setCreateError('Failed to delete student');
    }
  };

  if (route === '/admin') {
    return (
      <main className="shell">
        <aside className="sidebar">
          <h1>{heading}</h1>
          <button type="button" onClick={onLogout}>
            Logout
          </button>
        </aside>

        <section className="admin-students">
          <h2>Students</h2>

          <form className="login-form" onSubmit={onCreateStudent}>
            <label htmlFor="student-name">Name</label>
            <input
              id="student-name"
              type="text"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              required
            />

            <label htmlFor="student-email">Email</label>
            <input
              id="student-email"
              type="email"
              value={newStudentEmail}
              onChange={(e) => setNewStudentEmail(e.target.value)}
              required
            />

            <button type="submit">Add student</button>
          </form>

          {createError && <p className="error">{createError}</p>}
          {createPassword && <p className="secret">Generated password: {createPassword}</p>}
          {studentsError && <p className="error">{studentsError}</p>}

          {studentsLoading ? (
            <p>Loading students...</p>
          ) : (
            <table className="students-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Selected</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.name}</td>
                    <td>{student.email}</td>
                    <td>{student.hasSelectedTopic ? 'Yes' : 'No'}</td>
                    <td>
                      <button type="button" onClick={() => onDeleteStudent(student.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    );
  }

  if (route === '/topics') {
    return (
      <main className="shell">
        <header className="header">
          <h1>{heading}</h1>
          <button type="button" onClick={onLogout}>
            Logout
          </button>
        </header>
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
