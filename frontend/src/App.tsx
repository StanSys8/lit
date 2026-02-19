import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { addStudentToList, removeStudentFromList, type StudentRow } from './adminStudents';
import { credentialsToCsv, parseStudentsCsv, type CsvError, type CsvStudent } from './studentsCsv';
import { parseTopicsCsv, type CsvTopic } from './topicsCsv';
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

type BulkCreateResponse = {
  created: number;
  users: Array<{ name: string; email: string; password: string }>;
  errors: Array<{ row: number; message: string }>;
};

type TopicRow = {
  id: string;
  title: string;
  description: string;
  supervisor: string;
  department: string;
  selectedBy: { id: string; name: string } | null;
};

type CreateTopicResponse = TopicRow;
type TopicsBulkResponse = {
  created: number;
  errors: Array<{ row: number; message: string }>;
};

const normalizePath = (path: string) => {
  if (path === '/topics' || path === '/admin') return path;
  return '/login';
};

export const StudentActions = ({
  studentId,
  onDelete,
  onResetPassword,
}: {
  studentId: string;
  onDelete: (studentId: string) => void;
  onResetPassword: (studentId: string) => void;
}) => (
  <>
    <button type="button" onClick={() => onDelete(studentId)}>
      Delete
    </button>
    <button type="button" onClick={() => onResetPassword(studentId)}>
      Скинути пароль
    </button>
  </>
);

export const ResetPasswordModal = ({
  password,
  onClose,
}: {
  password: string;
  onClose: () => void;
}) => {
  if (!password) return null;

  return (
    <div className="modal-like" role="dialog" aria-label="Нове значення пароля">
      <p>Новий пароль (показується один раз):</p>
      <code>{password}</code>
      <p>Скопіюйте пароль та передайте студенту безпечно.</p>
      <button type="button" onClick={onClose}>
        Закрити
      </button>
    </div>
  );
};

export const ReleaseTopicModal = ({
  topicTitle,
  onConfirm,
  onCancel,
}: {
  topicTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  if (!topicTitle) return null;

  return (
    <div className="modal-like" role="dialog" aria-label="Підтвердження звільнення теми">
      <p>{`Звільнити тему "${topicTitle}"?`}</p>
      <p>Після цього тема знову стане доступною для вибору студентом.</p>
      <div className="modal-actions">
        <button type="button" onClick={onConfirm}>
          Підтвердити
        </button>
        <button type="button" onClick={onCancel}>
          Скасувати
        </button>
      </div>
    </div>
  );
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

  const [csvRows, setCsvRows] = useState<CsvStudent[]>([]);
  const [csvErrors, setCsvErrors] = useState<CsvError[]>([]);
  const [bulkErrors, setBulkErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [bulkCreated, setBulkCreated] = useState(0);
  const [bulkCredentials, setBulkCredentials] = useState<Array<{ name: string; email: string; password: string }>>([]);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicsError, setTopicsError] = useState('');
  const [createTopicError, setCreateTopicError] = useState('');
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicDescription, setNewTopicDescription] = useState('');
  const [newTopicSupervisor, setNewTopicSupervisor] = useState('');
  const [newTopicDepartment, setNewTopicDepartment] = useState('');
  const [topicCsvRows, setTopicCsvRows] = useState<CsvTopic[]>([]);
  const [topicCsvErrors, setTopicCsvErrors] = useState<CsvError[]>([]);
  const [topicBulkCreated, setTopicBulkCreated] = useState(0);
  const [topicBulkErrors, setTopicBulkErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [releaseTopicTargetId, setReleaseTopicTargetId] = useState('');
  const [releaseTopicTitle, setReleaseTopicTitle] = useState('');

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

  const loadTopics = async () => {
    setTopicsLoading(true);
    setTopicsError('');

    try {
      const response = await fetch('/admin/topics', {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        setTopicsError('Failed to load topics');
        return;
      }

      const payload = (await response.json()) as { topics: TopicRow[] };
      setTopics(payload.topics || []);
    } catch {
      setTopicsError('Failed to load topics');
    } finally {
      setTopicsLoading(false);
    }
  };

  useEffect(() => {
    if (route === '/admin') {
      void loadStudents();
      void loadTopics();
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

  const onResetPassword = async (studentId: string) => {
    setCreateError('');
    setResetPasswordValue('');
    try {
      const response = await fetch(`/admin/users/${studentId}/reset-password`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        setCreateError('Failed to reset password');
        return;
      }

      const payload = (await response.json()) as { newPassword?: string };
      setResetPasswordValue(payload.newPassword ?? '');
    } catch {
      setCreateError('Failed to reset password');
    }
  };

  const onCsvSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    setCsvErrors([]);
    setBulkErrors([]);
    setBulkCreated(0);
    setBulkCredentials([]);

    const file = event.target.files?.[0];
    if (!file) {
      setCsvRows([]);
      return;
    }

    const text = await file.text();
    const parsed = parseStudentsCsv(text);
    setCsvRows(parsed.rows);
    setCsvErrors(parsed.errors);
  };

  const onBulkUpload = async () => {
    setBulkErrors([]);
    setBulkCreated(0);
    setBulkCredentials([]);

    try {
      const response = await fetch('/admin/users/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(csvRows),
      });

      if (!response.ok) {
        setCreateError('Failed to upload CSV');
        return;
      }

      const payload = (await response.json()) as BulkCreateResponse;
      setBulkCreated(payload.created);
      setBulkErrors(payload.errors);
      setBulkCredentials(payload.users);

      if (payload.users.length > 0) {
        void loadStudents();
      }
    } catch {
      setCreateError('Failed to upload CSV');
    }
  };

  const onDownloadCredentials = () => {
    if (bulkCredentials.length === 0) return;

    const csv = credentialsToCsv(bulkCredentials);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'student-credentials.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const onCreateTopic = async (event: FormEvent) => {
    event.preventDefault();
    setCreateTopicError('');

    try {
      const response = await fetch('/admin/topics', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: newTopicTitle,
          description: newTopicDescription,
          supervisor: newTopicSupervisor,
          department: newTopicDepartment,
        }),
      });

      const payload = (await response.json()) as CreateTopicResponse | { message?: string };
      if (!response.ok) {
        setCreateTopicError((payload as { message?: string }).message || 'Failed to create topic');
        return;
      }

      const created = payload as CreateTopicResponse;
      setTopics((prev) => [...prev, created]);
      setNewTopicTitle('');
      setNewTopicDescription('');
      setNewTopicSupervisor('');
      setNewTopicDepartment('');
    } catch {
      setCreateTopicError('Failed to create topic');
    }
  };

  const onDeleteTopic = async (topicId: string) => {
    setCreateTopicError('');
    try {
      const response = await fetch(`/admin/topics/${topicId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.status === 204) {
        setTopics((prev) => prev.filter((topic) => topic.id !== topicId));
        return;
      }

      const payload = (await response.json()) as { error?: string; message?: string };
      if (response.status === 409 && payload.error === 'TOPIC_IN_USE') {
        setCreateTopicError(payload.message || 'Topic is already selected');
        return;
      }
      if (response.status === 404) {
        setCreateTopicError('Topic not found');
        return;
      }

      setCreateTopicError('Failed to delete topic');
    } catch {
      setCreateTopicError('Failed to delete topic');
    }
  };

  const onOpenReleaseTopicModal = (topic: TopicRow) => {
    setCreateTopicError('');
    setReleaseTopicTargetId(topic.id);
    setReleaseTopicTitle(topic.title);
  };

  const onConfirmReleaseTopic = async () => {
    if (!releaseTopicTargetId) return;
    setCreateTopicError('');

    try {
      const response = await fetch(`/admin/topics/${releaseTopicTargetId}/release`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const payload = (await response.json()) as { topic: TopicRow };
        setTopics((prev) => prev.map((topic) => (topic.id === payload.topic.id ? payload.topic : topic)));
        setReleaseTopicTargetId('');
        setReleaseTopicTitle('');
        return;
      }

      const payload = (await response.json()) as { error?: string; message?: string };
      if (response.status === 409 && payload.error === 'TOPIC_ALREADY_FREE') {
        setCreateTopicError(payload.message || 'Тема вже вільна');
      } else if (response.status === 404) {
        setCreateTopicError('Topic not found');
      } else {
        setCreateTopicError('Failed to release topic');
      }
      setReleaseTopicTargetId('');
      setReleaseTopicTitle('');
    } catch {
      setCreateTopicError('Failed to release topic');
      setReleaseTopicTargetId('');
      setReleaseTopicTitle('');
    }
  };

  const onTopicCsvSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    setTopicCsvErrors([]);
    setTopicBulkErrors([]);
    setTopicBulkCreated(0);

    const file = event.target.files?.[0];
    if (!file) {
      setTopicCsvRows([]);
      return;
    }

    const text = await file.text();
    const parsed = parseTopicsCsv(text);
    setTopicCsvRows(parsed.rows);
    setTopicCsvErrors(parsed.errors);
  };

  const onBulkTopicsUpload = async () => {
    setTopicBulkErrors([]);
    setTopicBulkCreated(0);
    setCreateTopicError('');

    try {
      const response = await fetch('/admin/topics/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(topicCsvRows),
      });

      if (!response.ok) {
        setCreateTopicError('Failed to upload topics CSV');
        return;
      }

      const payload = (await response.json()) as TopicsBulkResponse;
      setTopicBulkCreated(payload.created);
      setTopicBulkErrors(payload.errors);
      if (payload.created > 0) {
        void loadTopics();
      }
    } catch {
      setCreateTopicError('Failed to upload topics CSV');
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

          <section className="bulk-box">
            <h3>Bulk upload students</h3>
            <input type="file" accept=".csv,text/csv" onChange={onCsvSelect} />

            {csvRows.length > 0 && (
              <>
                <p>Preview (first 3 rows):</p>
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 3).map((row, idx) => (
                      <tr key={`${row.email}-${idx}`}>
                        <td>{row.name}</td>
                        <td>{row.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button type="button" onClick={onBulkUpload}>
                  Upload CSV
                </button>
              </>
            )}

            {csvErrors.length > 0 && (
              <ul className="error-list">
                {csvErrors.map((err) => (
                  <li key={`csv-${err.row}-${err.message}`}>{`Row ${err.row}: ${err.message}`}</li>
                ))}
              </ul>
            )}

            {bulkCreated > 0 && <p>{`Created ${bulkCreated} users`}</p>}
            {bulkErrors.length > 0 && (
              <ul className="error-list">
                {bulkErrors.map((err) => (
                  <li key={`bulk-${err.row}-${err.message}`}>{`Row ${err.row}: ${err.message}`}</li>
                ))}
              </ul>
            )}

            {bulkCredentials.length > 0 && (
              <button type="button" onClick={onDownloadCredentials}>
                Download credentials CSV
              </button>
            )}
          </section>

          {createError && <p className="error">{createError}</p>}
          <ResetPasswordModal password={resetPasswordValue} onClose={() => setResetPasswordValue('')} />
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
                      <StudentActions
                        studentId={student.id}
                        onDelete={onDeleteStudent}
                        onResetPassword={onResetPassword}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <section className="admin-topics">
            <h2>Topics</h2>

            <form className="login-form" onSubmit={onCreateTopic}>
              <label htmlFor="topic-title">Title</label>
              <input
                id="topic-title"
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                required
              />

              <label htmlFor="topic-description">Description</label>
              <input
                id="topic-description"
                type="text"
                value={newTopicDescription}
                onChange={(e) => setNewTopicDescription(e.target.value)}
                required
              />

              <label htmlFor="topic-supervisor">Supervisor</label>
              <input
                id="topic-supervisor"
                type="text"
                value={newTopicSupervisor}
                onChange={(e) => setNewTopicSupervisor(e.target.value)}
                required
              />

              <label htmlFor="topic-department">Department</label>
              <input
                id="topic-department"
                type="text"
                value={newTopicDepartment}
                onChange={(e) => setNewTopicDepartment(e.target.value)}
                required
              />

              <button type="submit">Add topic</button>
            </form>

            <section className="bulk-box">
              <h3>Bulk upload topics</h3>
              <input type="file" accept=".csv,text/csv" onChange={onTopicCsvSelect} />

              {topicCsvRows.length > 0 && (
                <>
                  <p>Preview (first 3 rows):</p>
                  <table className="students-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Description</th>
                        <th>Supervisor</th>
                        <th>Department</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topicCsvRows.slice(0, 3).map((row, idx) => (
                        <tr key={`${row.title}-${idx}`}>
                          <td>{row.title}</td>
                          <td>{row.description}</td>
                          <td>{row.supervisor}</td>
                          <td>{row.department}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <button type="button" onClick={onBulkTopicsUpload}>
                    Upload topics CSV
                  </button>
                </>
              )}

              {topicCsvErrors.length > 0 && (
                <ul className="error-list">
                  {topicCsvErrors.map((err) => (
                    <li key={`topic-csv-${err.row}-${err.message}`}>{`Row ${err.row}: ${err.message}`}</li>
                  ))}
                </ul>
              )}

              {topicBulkCreated > 0 && <p>{`Created ${topicBulkCreated} topics`}</p>}
              {topicBulkErrors.length > 0 && (
                <ul className="error-list">
                  {topicBulkErrors.map((err) => (
                    <li key={`topic-bulk-${err.row}-${err.message}`}>{`Row ${err.row}: ${err.message}`}</li>
                  ))}
                </ul>
              )}
            </section>

            {createTopicError && <p className="error">{createTopicError}</p>}
            {topicsError && <p className="error">{topicsError}</p>}
            <ReleaseTopicModal
              topicTitle={releaseTopicTitle}
              onConfirm={onConfirmReleaseTopic}
              onCancel={() => {
                setReleaseTopicTargetId('');
                setReleaseTopicTitle('');
              }}
            />

            {topicsLoading ? (
              <p>Loading topics...</p>
            ) : (
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Description</th>
                    <th>Supervisor</th>
                    <th>Department</th>
                    <th>Student</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map((topic) => (
                    <tr key={topic.id}>
                      <td>{topic.title}</td>
                      <td>{topic.description}</td>
                      <td>{topic.supervisor}</td>
                      <td>{topic.department}</td>
                      <td>{topic.selectedBy?.name || 'вільна'}</td>
                      <td>
                        <button type="button" onClick={() => onDeleteTopic(topic.id)}>
                          Delete topic
                        </button>
                        {topic.selectedBy && (
                          <button type="button" onClick={() => onOpenReleaseTopicModal(topic)}>
                            Звільнити тему
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
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
