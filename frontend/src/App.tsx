import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, RefObject } from 'react';
import { addStudentToList, removeStudentFromList, type StudentRow } from './adminStudents';
import { credentialsToCsv, parseStudentsCsv, type CsvError, type CsvStudent } from './studentsCsv';
import { parseTopicsCsv, type CsvTopic } from './topicsCsv';
import { releaseTopicByAdmin, uploadTopicsCsv, type TopicsBulkResponse } from './adminTopicsFlows';
import { apiUrl } from './apiBase';
import './App.css';

type LoginResponse = {
  id: string;
  email: string;
  role: 'student' | 'admin';
  selectedTopic: StudentTopic | null;
};

type CreateStudentResponse = {
  id: string;
  name: string;
  email: string;
  class: string;
  newPassword: string;
};

type BulkCreateResponse = {
  created: number;
  users: Array<{ name: string; email: string; class: string; password: string }>;
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

type AuditRow = {
  id: string;
  actor: string;
  action: string;
  targetId: string | null;
  ip: string;
  result: string;
  createdAt: string;
};

type StudentTopic = {
  id: string;
  title: string;
  description: string;
  supervisor: string;
  department: string;
};

type StudentSelectResponse = {
  topic: {
    id: string;
    title: string;
    selectedBy: string;
  };
};

type CreateTopicResponse = TopicRow;

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
      Видалити
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

export const TopicAccordionItem = ({
  topic,
  expanded,
  onToggle,
  onSelectTopic,
}: {
  topic: StudentTopic;
  expanded: boolean;
  onToggle: () => void;
  onSelectTopic: (topic: StudentTopic) => void;
}) => (
  <article className={`topic-accordion-item ${expanded ? 'topic-accordion-item--open' : ''}`} data-testid="topic-accordion-item">
    <button type="button" className="topic-accordion-trigger" onClick={onToggle}>
      <span>{topic.title}</span>
      <span className="topic-availability-badge">вільна</span>
    </button>
    {expanded && (
      <div className="topic-accordion-content">
        <p>{topic.description}</p>
        <p>{`Науковий керівник: ${topic.supervisor}`}</p>
        <p>{`Кафедра: ${topic.department}`}</p>
        <button
          type="button"
          className="topic-select-btn"
          onClick={() => onSelectTopic(topic)}
        >
          Вибрати цю тему
        </button>
      </div>
    )}
  </article>
);

export const TopicConfirmDialog = ({
  topic,
  pending,
  backButtonRef,
  onCancel,
  onConfirm,
}: {
  topic: StudentTopic | null;
  pending: boolean;
  backButtonRef: RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  if (!topic) return null;

  return (
    <div className="topic-dialog-overlay" role="presentation" data-testid="topic-confirm-overlay">
      <div className="topic-dialog" role="dialog" aria-modal="true" aria-label="Підтвердження вибору теми">
        <p>{`Ти вибираєш: ${topic.title}. Змінити самостійно не можна — тільки через вчителя.`}</p>
        <div className="modal-actions">
          <button ref={backButtonRef} type="button" onClick={onCancel} disabled={pending}>
            Назад до списку
          </button>
          <button type="button" onClick={onConfirm} disabled={pending}>
            {pending ? 'Зберігаємо...' : 'Так, беру цю тему'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const TopicConfirmedScreen = ({ topic }: { topic: StudentTopic }) => (
  <section className="topic-confirmed">
    <p className="topic-confirmed-mark">✓</p>
    <h2>Тему вибрано!</h2>
    <p>{topic.title}</p>
    <p>Якщо потрібна зміна — звернись до вчителя</p>
  </section>
);

export const AdminStatCard = ({
  title,
  value,
  subtitle,
  progressPercent,
  variant = 'warning',
}: {
  title: string;
  value: string;
  subtitle: string;
  progressPercent: number;
  variant?: 'primary' | 'warning';
}) => (
  <article
    className={`admin-stat-card ${variant === 'primary' ? 'border-[#B436F0]' : 'border-[#F24C0A]'}`}
    data-testid="admin-stat-card"
  >
    <p className="admin-stat-card-title">{title}</p>
    <p className="admin-stat-card-value">{value}</p>
    <div className="admin-stat-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
      <span style={{ width: `${progressPercent}%` }} />
    </div>
    <p className="admin-stat-card-subtitle">{subtitle}</p>
  </article>
);

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [route, setRoute] = useState(() => {
    if (typeof window === 'undefined') return '/login';
    return normalizePath(window.location.pathname);
  });
  const [studentTopics, setStudentTopics] = useState<StudentTopic[]>([]);
  const [studentTopicsLoading, setStudentTopicsLoading] = useState(false);
  const [studentTopicsError, setStudentTopicsError] = useState('');
  const [studentTopicActionError, setStudentTopicActionError] = useState('');
  const [raceConditionAlert, setRaceConditionAlert] = useState('');
  const [topicSearch, setTopicSearch] = useState('');
  const [debouncedTopicSearch, setDebouncedTopicSearch] = useState('');
  const [expandedTopicId, setExpandedTopicId] = useState('');
  const [topicConfirmTarget, setTopicConfirmTarget] = useState<StudentTopic | null>(null);
  const [topicSelectPending, setTopicSelectPending] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<StudentTopic | null>(null);
  const topicConfirmBackButtonRef = useRef<HTMLButtonElement>(null);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState('');
  const [createError, setCreateError] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('');

  const [csvRows, setCsvRows] = useState<CsvStudent[]>([]);
  const [csvErrors, setCsvErrors] = useState<CsvError[]>([]);
  const [bulkErrors, setBulkErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [bulkCreated, setBulkCreated] = useState(0);
  const [bulkCredentials, setBulkCredentials] = useState<Array<{ name: string; email: string; class: string; password: string }>>([]);
  const [studentsCsvInputKey, setStudentsCsvInputKey] = useState(0);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicsError, setTopicsError] = useState('');
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [exportStatusError, setExportStatusError] = useState('');
  const [exportStatusLoading, setExportStatusLoading] = useState(false);
  const [exportAuditError, setExportAuditError] = useState('');
  const [exportAuditLoading, setExportAuditLoading] = useState(false);
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
  const [adminTab, setAdminTab] = useState<'status' | 'students' | 'topics' | 'audit'>('status');

  const heading = useMemo(() => {
    if (route === '/topics') return 'Вибір теми';
    if (route === '/admin') return 'Панель адміністратора';
    return 'Вхід';
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
      const response = await fetch(apiUrl('/admin/users'), {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        setStudentsError('Не вдалося завантажити список студентів');
        return;
      }

      const payload = (await response.json()) as StudentRow[];
      setStudents(payload);
    } catch {
      setStudentsError('Не вдалося завантажити список студентів');
    } finally {
      setStudentsLoading(false);
    }
  };

  const loadStudentTopics = async () => {
    setStudentTopicsLoading(true);
    setStudentTopicsError('');

    try {
      const response = await fetch(apiUrl('/topics'), {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        setStudentTopicsError('Не вдалося завантажити список тем');
        return;
      }

      const payload = (await response.json()) as StudentTopic[];
      setStudentTopics(payload || []);
    } catch {
      setStudentTopicsError('Не вдалося завантажити список тем');
    } finally {
      setStudentTopicsLoading(false);
    }
  };

  const loadTopics = async () => {
    setTopicsLoading(true);
    setTopicsError('');

    try {
      const response = await fetch(apiUrl('/admin/topics'), {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        setTopicsError('Не вдалося завантажити список тем');
        return;
      }

      const payload = (await response.json()) as { topics: TopicRow[] };
      setTopics(payload.topics || []);
    } catch {
      setTopicsError('Не вдалося завантажити список тем');
    } finally {
      setTopicsLoading(false);
    }
  };

  const loadAudit = async () => {
    setAuditLoading(true);
    setAuditError('');
    try {
      const response = await fetch(apiUrl('/admin/audit'), {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        setAuditError('Не вдалося завантажити журнал дій');
        return;
      }
      const payload = (await response.json()) as AuditRow[];
      setAuditRows(payload || []);
    } catch {
      setAuditError('Не вдалося завантажити журнал дій');
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (route === '/admin') {
      void loadStudents();
      void loadTopics();
      void loadAudit();
    }
    if (route === '/topics') {
      void loadStudentTopics();
    }
  }, [route]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTopicSearch(topicSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [topicSearch]);

  useEffect(() => {
    if (!topicConfirmTarget) return;
    topicConfirmBackButtonRef.current?.focus();
  }, [topicConfirmTarget]);

  useEffect(() => {
    if (!raceConditionAlert) return;
    const timer = setTimeout(() => setRaceConditionAlert(''), 8000);
    return () => clearTimeout(timer);
  }, [raceConditionAlert]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as LoginResponse | { message?: string };
      if (!response.ok) {
        setError((payload as { message?: string }).message || 'Не вдалося увійти');
        return;
      }

      if ((payload as LoginResponse).role === 'admin') {
        setSelectedTopic(null);
        navigate('/admin');
      } else {
        setSelectedTopic((payload as LoginResponse).selectedTopic || null);
        navigate('/topics');
      }
    } catch {
      setError('Помилка мережі');
    } finally {
      setLoading(false);
    }
  };

  const onLogout = async () => {
    try {
      await fetch(apiUrl('/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setSelectedTopic(null);
      navigate('/login');
    }
  };

  const onCreateStudent = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError('');
    setCreatePassword('');

    try {
      const response = await fetch(apiUrl('/admin/users'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: newStudentName, email: newStudentEmail, class: newStudentClass }),
      });

      const payload = (await response.json()) as CreateStudentResponse | { message?: string };
      if (!response.ok) {
        setCreateError((payload as { message?: string }).message || 'Не вдалося додати студента');
        return;
      }

      const created = payload as CreateStudentResponse;
      setStudents((prev) =>
        addStudentToList(prev, {
          id: created.id,
          name: created.name,
          email: created.email,
          class: created.class,
          hasSelectedTopic: false,
        }),
      );
      setCreatePassword(created.newPassword);
      setNewStudentName('');
      setNewStudentEmail('');
      setNewStudentClass('');
    } catch {
      setCreateError('Не вдалося додати студента');
    }
  };

  const onDeleteStudent = async (studentId: string) => {
    setCreateError('');

    try {
      const response = await fetch(apiUrl(`/admin/users/${studentId}`), {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.status === 204) {
        setStudents((prev) => removeStudentFromList(prev, studentId));
        return;
      }

      if (response.status === 404) {
        setCreateError('Студента не знайдено');
        return;
      }

      setCreateError('Не вдалося видалити студента');
    } catch {
      setCreateError('Не вдалося видалити студента');
    }
  };

  const onResetPassword = async (studentId: string) => {
    setCreateError('');
    setResetPasswordValue('');
    try {
      const response = await fetch(apiUrl(`/admin/users/${studentId}/reset-password`), {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        setCreateError('Не вдалося скинути пароль');
        return;
      }

      const payload = (await response.json()) as { newPassword?: string };
      setResetPasswordValue(payload.newPassword ?? '');
    } catch {
      setCreateError('Не вдалося скинути пароль');
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
    setCreateError('');
    setBulkErrors([]);
    setBulkCreated(0);
    setBulkCredentials([]);

    try {
      const response = await fetch(apiUrl('/admin/users/bulk'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(csvRows),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
        setCreateError(payload.message || payload.error || `Не вдалося завантажити CSV (HTTP ${response.status})`);
        return;
      }

      const payload = (await response.json()) as BulkCreateResponse;
      setBulkCreated(payload.created);
      setBulkErrors(payload.errors);
      setBulkCredentials(payload.users);

      if (payload.users.length > 0) {
        // Show newly created students immediately, then sync from server.
        setStudents((prev) => {
          const existing = new Set(prev.map((item) => item.email.toLowerCase()));
          const appended = payload.users
            .filter((item) => !existing.has(item.email.toLowerCase()))
            .map((item, idx) => ({
              id: `bulk-${Date.now()}-${idx}`,
              name: item.name,
              email: item.email,
              class: item.class,
              hasSelectedTopic: false,
            }));
          return [...prev, ...appended];
        });
        downloadCredentialsCsv(payload.users);
        await loadStudents();
      }
    } catch {
      setCreateError('Не вдалося завантажити CSV');
    }
  };

  const downloadCredentialsCsv = (items: Array<{ name: string; email: string; class: string; password: string }>) => {
    if (items.length === 0) return;
    const csv = credentialsToCsv(items);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'student-credentials.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const onDownloadCredentials = () => {
    downloadCredentialsCsv(bulkCredentials);
  };

  const onResetStudentsCsv = () => {
    setCsvRows([]);
    setCsvErrors([]);
    setBulkErrors([]);
    setBulkCreated(0);
    setBulkCredentials([]);
    setStudentsCsvInputKey((prev) => prev + 1);
  };

  const onExportTopicsStatus = async () => {
    setExportStatusError('');
    setExportStatusLoading(true);

    try {
      const response = await fetch(apiUrl('/admin/export/status'), {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        setExportStatusError('Не вдалося завантажити CSV статусу');
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] || 'topics-status.csv';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportStatusError('Не вдалося завантажити CSV статусу');
    } finally {
      setExportStatusLoading(false);
    }
  };

  const onExportAuditLog = async () => {
    setExportAuditError('');
    setExportAuditLoading(true);

    try {
      const response = await fetch(apiUrl('/admin/export/audit'), {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        setExportAuditError('Не вдалося завантажити CSV аудиту');
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] || 'audit-log.csv';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportAuditError('Не вдалося завантажити CSV аудиту');
    } finally {
      setExportAuditLoading(false);
    }
  };

  const onCreateTopic = async (event: FormEvent) => {
    event.preventDefault();
    setCreateTopicError('');

    try {
      const response = await fetch(apiUrl('/admin/topics'), {
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
        setCreateTopicError((payload as { message?: string }).message || 'Не вдалося додати тему');
        return;
      }

      const created = payload as CreateTopicResponse;
      setTopics((prev) => [...prev, created]);
      setNewTopicTitle('');
      setNewTopicDescription('');
      setNewTopicSupervisor('');
      setNewTopicDepartment('');
    } catch {
      setCreateTopicError('Не вдалося додати тему');
    }
  };

  const onDeleteTopic = async (topicId: string) => {
    setCreateTopicError('');
    try {
      const response = await fetch(apiUrl(`/admin/topics/${topicId}`), {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.status === 204) {
        setTopics((prev) => prev.filter((topic) => topic.id !== topicId));
        return;
      }

      const payload = (await response.json()) as { error?: string; message?: string };
      if (response.status === 409 && payload.error === 'TOPIC_IN_USE') {
        setCreateTopicError(payload.message || 'Тема вже вибрана');
        return;
      }
      if (response.status === 404) {
        setCreateTopicError('Тему не знайдено');
        return;
      }

      setCreateTopicError('Не вдалося видалити тему');
    } catch {
      setCreateTopicError('Не вдалося видалити тему');
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

    const result = await releaseTopicByAdmin(releaseTopicTargetId);
    if (result.ok) {
      setTopics((prev) => prev.map((topic) => (topic.id === result.topic.id ? result.topic : topic)));
      setReleaseTopicTargetId('');
      setReleaseTopicTitle('');
      return;
    }

    if (result.status === 409 && result.error === 'TOPIC_ALREADY_FREE') {
      setCreateTopicError(result.message || 'Тема вже вільна');
    } else if (result.status === 404) {
      setCreateTopicError('Тему не знайдено');
    } else {
      setCreateTopicError(result.message || 'Не вдалося звільнити тему');
    }
    setReleaseTopicTargetId('');
    setReleaseTopicTitle('');
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

    const result = await uploadTopicsCsv(topicCsvRows);
    if (!result.ok) {
      setCreateTopicError(result.message);
      return;
    }

    const payload = result.payload as TopicsBulkResponse;
    setTopicBulkCreated(payload.created);
    setTopicBulkErrors(payload.errors);
    if (payload.created > 0) {
      void loadTopics();
    }
  };

  const onOpenTopicConfirm = (topic: StudentTopic) => {
    setStudentTopicActionError('');
    setRaceConditionAlert('');
    setTopicConfirmTarget(topic);
  };

  const onConfirmTopicSelect = async () => {
    if (!topicConfirmTarget) return;
    setStudentTopicActionError('');
    setRaceConditionAlert('');
    setTopicSelectPending(true);

    let shouldRefreshTopics = false;
    try {
      const response = await fetch(apiUrl(`/topics/${topicConfirmTarget.id}/select`), {
        method: 'POST',
        credentials: 'include',
      });

      const payload = (await response.json()) as
        | StudentSelectResponse
        | { error?: string; message?: string };

      if (response.ok) {
        const selected = topicConfirmTarget;
        setSelectedTopic(selected);
        setExpandedTopicId('');
        setTopicConfirmTarget(null);
        shouldRefreshTopics = true;
        return;
      }

      if (response.status === 409) {
        const errorPayload = payload as { error?: string; message?: string };
        shouldRefreshTopics = true;
        if (errorPayload.error === 'TOPIC_ALREADY_TAKEN') {
          setRaceConditionAlert('Цю тему щойно вибрав інший учень 😔 Список оновлено — оберіть іншу.');
        } else if (errorPayload.error === 'ALREADY_SELECTED') {
          setStudentTopicActionError('Ви вже обрали тему. Змінити вибір може тільки вчитель.');
        } else {
          setStudentTopicActionError(errorPayload.message || 'Не вдалося вибрати тему');
        }
      } else if (response.status === 404) {
        setStudentTopicActionError('Тему не знайдено');
      } else {
        const errorPayload = payload as { message?: string };
        setStudentTopicActionError(errorPayload.message || 'Не вдалося вибрати тему');
      }

      setTopicConfirmTarget(null);
    } catch {
      setStudentTopicActionError('Не вдалося вибрати тему');
      setTopicConfirmTarget(null);
    } finally {
      if (shouldRefreshTopics) {
        void loadStudentTopics();
      }
      setTopicSelectPending(false);
    }
  };

  const filteredStudentTopics = useMemo(() => {
    const query = debouncedTopicSearch.toLowerCase();
    if (!query) return studentTopics;
    return studentTopics.filter((topic) => topic.title.toLowerCase().includes(query));
  }, [debouncedTopicSearch, studentTopics]);
  const selectedStudentsCount = useMemo(() => students.filter((student) => student.hasSelectedTopic).length, [students]);
  const totalStudentsCount = students.length;
  const selectionProgress = totalStudentsCount > 0 ? Math.round((selectedStudentsCount / totalStudentsCount) * 100) : 0;
  const remainingStudentsCount = Math.max(0, totalStudentsCount - selectedStudentsCount);
  const freeTopicsCount = useMemo(() => topics.filter((topic) => !topic.selectedBy).length, [topics]);
  const totalTopicsCount = topics.length;

  if (route === '/admin') {
    return (
      <main className="shell shell--admin">
        <aside className="admin-sidebar">
          <div className="admin-logo">
            <span>Система вибору тем</span>
          </div>
          <nav className="admin-nav">
            <button
              type="button"
              className={`admin-nav-item ${adminTab === 'status' ? 'active' : ''}`}
              onClick={() => setAdminTab('status')}
            >
              📊 Статус
            </button>
            <button
              type="button"
              className={`admin-nav-item ${adminTab === 'students' ? 'active' : ''}`}
              onClick={() => setAdminTab('students')}
            >
              👥 Студенти
            </button>
            <button
              type="button"
              className={`admin-nav-item ${adminTab === 'topics' ? 'active' : ''}`}
              onClick={() => setAdminTab('topics')}
            >
              📋 Теми
            </button>
            <button
              type="button"
              className={`admin-nav-item ${adminTab === 'audit' ? 'active' : ''}`}
              onClick={() => setAdminTab('audit')}
            >
              📝 Журнал дій
            </button>
          </nav>
          <button type="button" className="admin-logout-btn" onClick={onLogout}>
            Вийти
          </button>
        </aside>

        <section className="admin-content">
          {adminTab === 'status' && (
            <section className="admin-panel" data-testid="admin-dashboard-stats">
              <h1 className="admin-title">Статус вибору тем</h1>
              <div className="admin-stats">
                <article className="admin-stat">
                  <p className="admin-stat-num">{selectedStudentsCount}</p>
                  <p className="admin-stat-label">студентів вибрали</p>
                </article>
                <article className="admin-stat admin-stat-orange">
                  <p className="admin-stat-num">{remainingStudentsCount}</p>
                  <p className="admin-stat-label">не вибрали ще</p>
                </article>
              </div>
              <section className="admin-progress">
                <div className="admin-progress-label">
                  <span>Прогрес</span>
                  <span>{`${selectedStudentsCount} / ${totalStudentsCount}`}</span>
                </div>
                <div className="admin-progress-bar">
                  <span className="admin-progress-fill" style={{ width: `${selectionProgress}%` }} />
                </div>
              </section>
              <div className="admin-dashboard-actions">
                <button type="button" onClick={onExportTopicsStatus} disabled={exportStatusLoading}>
                  {exportStatusLoading ? 'Експорт...' : '⬇ Вивантажити CSV'}
                </button>
                {exportStatusError && <p className="error">{exportStatusError}</p>}
              </div>
              <div className="admin-topic-health">{`${freeTopicsCount} вільних тем із ${totalTopicsCount}`}</div>
            </section>
          )}

          {adminTab === 'students' && (
            <section className="admin-panel">
              <div className="admin-panel-header">
                <h1 className="admin-title">Студенти</h1>
              </div>
              <form className="login-form" onSubmit={onCreateStudent}>
                <label htmlFor="student-name">Ім'я</label>
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

                <label htmlFor="student-class">Клас</label>
                <input
                  id="student-class"
                  type="text"
                  value={newStudentClass}
                  onChange={(e) => setNewStudentClass(e.target.value)}
                  required
                />

                <button type="submit">Додати студента</button>
              </form>

              <section className="bulk-box">
                <h3>Масове завантаження студентів</h3>
                <input
                  key={studentsCsvInputKey}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={onCsvSelect}
                />

                {csvRows.length > 0 && (
                  <>
                    <p>Попередній перегляд (перші 3 рядки):</p>
                    <table className="students-table">
                      <thead>
                        <tr>
                          <th>Ім'я</th>
                          <th>Email</th>
                          <th>Клас</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0, 3).map((row, idx) => (
                          <tr key={`${row.email}-${idx}`}>
                            <td>{row.name}</td>
                            <td>{row.email}</td>
                            <td>{row.class}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <button type="button" onClick={onBulkUpload}>
                      Завантажити CSV
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

                {bulkCreated > 0 && <p>{`Створено ${bulkCreated} користувачів`}</p>}
                {bulkErrors.length > 0 && (
                  <ul className="error-list">
                    {bulkErrors.map((err) => (
                      <li key={`bulk-${err.row}-${err.message}`}>{`Row ${err.row}: ${err.message}`}</li>
                    ))}
                  </ul>
                )}

                {bulkCredentials.length > 0 && (
                  <button type="button" onClick={onDownloadCredentials}>
                    Завантажити CSV з паролями
                  </button>
                )}

                {(csvErrors.length > 0 || bulkErrors.length > 0) && (
                  <button type="button" className="admin-btn-muted" onClick={onResetStudentsCsv}>
                    Скинути CSV
                  </button>
                )}
              </section>

              {createError && <p className="error">{createError}</p>}
              <ResetPasswordModal password={resetPasswordValue} onClose={() => setResetPasswordValue('')} />
              {createPassword && <p className="secret">Згенерований пароль: {createPassword}</p>}
              {studentsError && <p className="error">{studentsError}</p>}

              {studentsLoading ? (
                <p>Завантаження студентів...</p>
              ) : (
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Ім'я</th>
                      <th>Email</th>
                      <th>Клас</th>
                      <th>Тему обрано</th>
                      <th>Дії</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id}>
                        <td>{student.name}</td>
                        <td>{student.email}</td>
                        <td>{student.class}</td>
                        <td>{student.hasSelectedTopic ? 'Так' : 'Ні'}</td>
                        <td className="table-actions">
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
            </section>
          )}

          {adminTab === 'topics' && (
            <section className="admin-panel">
              <div className="admin-panel-header">
                <h1 className="admin-title">Теми</h1>
                <div className="admin-panel-actions">
                  <button type="button" className="admin-btn-muted">
                    ⬆ CSV
                  </button>
                  <button type="button">+ Додати тему</button>
                </div>
              </div>

              <form className="login-form" onSubmit={onCreateTopic}>
                <label htmlFor="topic-title">Назва</label>
                <input
                  id="topic-title"
                  type="text"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  required
                />

                <label htmlFor="topic-description">Опис</label>
                <input
                  id="topic-description"
                  type="text"
                  value={newTopicDescription}
                  onChange={(e) => setNewTopicDescription(e.target.value)}
                  required
                />

                <label htmlFor="topic-supervisor">Керівник</label>
                <input
                  id="topic-supervisor"
                  type="text"
                  value={newTopicSupervisor}
                  onChange={(e) => setNewTopicSupervisor(e.target.value)}
                  required
                />

                <label htmlFor="topic-department">Кафедра</label>
                <input
                  id="topic-department"
                  type="text"
                  value={newTopicDepartment}
                  onChange={(e) => setNewTopicDepartment(e.target.value)}
                  required
                />

                <button type="submit">Додати тему</button>
              </form>

              <section className="bulk-box">
                <h3>Масове завантаження тем</h3>
                <input type="file" accept=".csv,text/csv" onChange={onTopicCsvSelect} />

                {topicCsvRows.length > 0 && (
                  <>
                    <p>Попередній перегляд (перші 3 рядки):</p>
                    <table className="students-table">
                      <thead>
                        <tr>
                          <th>Назва</th>
                          <th>Опис</th>
                          <th>Керівник</th>
                          <th>Кафедра</th>
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
                      Завантажити CSV тем
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

                {topicBulkCreated > 0 && <p>{`Створено ${topicBulkCreated} тем`}</p>}
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
                <p>Завантаження тем...</p>
              ) : (
                <div className="admin-table">
                  <div className="admin-table-header">
                    <span className="admin-table-title">{`${totalTopicsCount} тем всього`}</span>
                  </div>
                  <table className="students-table">
                    <thead>
                      <tr>
                        <th>Назва теми</th>
                        <th>Статус</th>
                        <th>Студент</th>
                        <th>Дії</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topics.map((topic) => (
                        <tr key={topic.id}>
                          <td>{topic.title}</td>
                          <td>
                            <span className={`badge ${topic.selectedBy ? 'badge-taken' : 'badge-free'}`}>
                              {topic.selectedBy ? 'зайнята' : 'вільна'}
                            </span>
                          </td>
                          <td>{topic.selectedBy?.name || '—'}</td>
                          <td className="table-actions">
                            <button type="button" onClick={() => onDeleteTopic(topic.id)}>
                              Видалити
                            </button>
                            {topic.selectedBy && (
                              <button type="button" onClick={() => onOpenReleaseTopicModal(topic)}>
                                Звільнити
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {adminTab === 'audit' && (
            <section className="admin-panel">
              <div className="admin-panel-header">
                <h1 className="admin-title">Журнал дій</h1>
                <button type="button" onClick={onExportAuditLog} disabled={exportAuditLoading}>
                  {exportAuditLoading ? 'Експорт...' : '⬇ Вивантажити CSV'}
                </button>
              </div>
              {exportAuditError && <p className="error">{exportAuditError}</p>}
              {auditError && <p className="error">{auditError}</p>}
              {auditLoading ? (
                <p>Завантаження журналу...</p>
              ) : (
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Час</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>IP</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.length === 0 ? (
                      <tr>
                        <td colSpan={5}>Немає записів аудиту</td>
                      </tr>
                    ) : (
                      auditRows.map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.createdAt).toLocaleString('uk-UA')}</td>
                          <td>{row.actor}</td>
                          <td>{row.action}</td>
                          <td>{row.ip}</td>
                          <td>{row.result}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </section>
      </main>
    );
  }

  if (route === '/topics') {
    return (
      <main className="shell shell--student">
        <header className="header">
          <h1>{heading}</h1>
          <button type="button" onClick={onLogout}>
            Вийти
          </button>
        </header>

        <section className="student-topics">
          {selectedTopic ? (
            <TopicConfirmedScreen topic={selectedTopic} />
          ) : (
            <>
              <div className="topic-search-wrap">
                <label className="visually-hidden" htmlFor="topics-search">
                  Пошук теми
                </label>
                <input
                  id="topics-search"
                  type="text"
                  value={topicSearch}
                  onChange={(e) => setTopicSearch(e.target.value)}
                  placeholder="Введіть назву теми"
                />
              </div>

              {studentTopicsError && <p className="error">{studentTopicsError}</p>}
              {studentTopicActionError && <p className="error">{studentTopicActionError}</p>}
              {raceConditionAlert && <p className="topic-race-alert">{raceConditionAlert}</p>}

              {studentTopicsLoading && (
                <div className="topic-skeletons" aria-label="Завантаження тем">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="topic-skeleton-row" />
                  ))}
                </div>
              )}

              {!studentTopicsLoading && studentTopics.length === 0 && (
                <p>Всі теми вже вибрані. Зверніться до вчителя.</p>
              )}

              {!studentTopicsLoading && studentTopics.length > 0 && filteredStudentTopics.length === 0 && (
                <p>{`Нічого не знайдено за запитом «${debouncedTopicSearch}»`}</p>
              )}

              {!studentTopicsLoading &&
                filteredStudentTopics.map((topic) => (
                  <TopicAccordionItem
                    key={topic.id}
                    topic={topic}
                    expanded={expandedTopicId === topic.id}
                    onToggle={() => setExpandedTopicId((prev) => (prev === topic.id ? '' : topic.id))}
                    onSelectTopic={onOpenTopicConfirm}
                  />
                ))}
            </>
          )}

          <TopicConfirmDialog
            topic={topicConfirmTarget}
            pending={topicSelectPending}
            backButtonRef={topicConfirmBackButtonRef}
            onCancel={() => setTopicConfirmTarget(null)}
            onConfirm={onConfirmTopicSelect}
          />
        </section>
      </main>
    );
  }

  return (
    <main className="shell shell--login">
      <h1>{heading}</h1>
      <p className="login-project-title">Вибір тем курсових робіт</p>
      <form className="login-form" onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password">Пароль</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Вхід...' : 'Увійти'}
        </button>
      </form>
    </main>
  );
}

export default App;
