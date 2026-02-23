import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, RefObject } from 'react';
import { addStudentToList, removeStudentFromList, type StudentRow } from './adminStudents';
import { credentialsToCsv, parseStudentsCsv, type CsvError, type CsvStudent } from './studentsCsv';
import { parseTopicsCsv, type CsvTopic } from './topicsCsv';
import { releaseTopicByAdmin, uploadTopicsCsv, type TopicsBulkResponse } from './adminTopicsFlows';
import { apiUrl } from './apiBase';
import './App.css';

type LoginResponse = {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin';
  selectedTopic: StudentTopic | null;
  adminEmail: string;
  token?: string;
};

type CreateStudentResponse = {
  id: string;
  name: string;
  email: string;
  class: string;
  newPassword: string;
  loginStatus: 'logged_in' | 'not_logged_in';
  lastLoginAt: string | null;
  credentialEmailStatus?: 'sent' | 'failed' | 'disabled';
};

type BulkCreateResponse = {
  created: number;
  users: Array<{ name: string; email: string; class: string; password: string; loginStatus?: string }>;
  errors: Array<{ row: number; message: string }>;
};

type TopicRow = {
  id: string;
  title: string;
  description: string;
  supervisor: string;
  department: string;
  selectedBy: { id: string; name: string; class: string } | null;
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
type SortDirection = 'asc' | 'desc';
type StudentsSortKey = 'name' | 'email' | 'class' | 'hasSelectedTopic' | 'loginStatus';
type TopicsSortKey = 'title' | 'supervisor' | 'department' | 'status' | 'student';

const compareText = (left: string, right: string) => left.localeCompare(right, 'uk', { sensitivity: 'base' });

const nextSort = <K extends string>(current: { key: K; direction: SortDirection }, key: K): { key: K; direction: SortDirection } => {
  if (current.key !== key) return { key, direction: 'asc' };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
};

const renderStackedName = (fullName: string) => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  return (
    <span className="stacked-name">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>{part}</span>
      ))}
    </span>
  );
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
    <button type="button" className="table-action-btn table-action-btn-danger" onClick={() => onDelete(studentId)}>
      Видалити
    </button>
    <button type="button" className="table-action-btn table-action-btn-soft" onClick={() => onResetPassword(studentId)}>
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
      <button type="button" className="modal-btn-secondary" onClick={onClose}>
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
        <button type="button" className="modal-btn-secondary" onClick={onCancel}>
          Скасувати
        </button>
        <button type="button" onClick={onConfirm}>
          Підтвердити
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
  adminEmail,
  onCancel,
  onConfirm,
}: {
  topic: StudentTopic | null;
  pending: boolean;
  backButtonRef: RefObject<HTMLButtonElement | null>;
  adminEmail: string;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  if (!topic) return null;

  return (
    <div className="topic-dialog-overlay" role="presentation" data-testid="topic-confirm-overlay">
      <div className="topic-dialog" role="dialog" aria-modal="true" aria-label="Підтвердження вибору теми">
        <p>Обрана тема:</p>
        <p className="topic-confirm-selected-topic">{topic.title}</p>
        <p>
          Змінити самостійно не можна.
          {' '}
          {adminEmail ? (
            <>
              Якщо потрібна зміна теми — пишіть на пошту <a href={`mailto:${adminEmail}`}>{adminEmail}</a>.
            </>
          ) : (
            'Якщо потрібна зміна теми — зверніться до адміністратора.'
          )}
        </p>
        <div className="modal-actions">
          <button ref={backButtonRef} type="button" className="modal-btn-secondary" onClick={onCancel} disabled={pending}>
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

export const RaceConditionModal = ({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) => {
  if (!message) return null;
  const [headline, details] = message.split('\n');

  return (
    <div className="topic-dialog-overlay topic-race-overlay" role="presentation" data-testid="topic-race-overlay" onClick={onClose}>
      <div className="topic-race-modal" role="alertdialog" aria-modal="true" aria-label="Повідомлення про недоступну тему" onClick={(event) => event.stopPropagation()}>
        <span className="topic-race-modal-icon" aria-hidden="true">😔</span>
        <p className="topic-race-modal-text">
          <strong>{headline}</strong>
          {details && (
            <>
              <br />
              {details}
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export const TopicConfirmedScreen = ({ topic, studentName, adminEmail }: { topic: StudentTopic; studentName: string; adminEmail: string }) => (
  <section className="topic-confirmed">
    <div className="topic-confirmed-checkmark" aria-hidden="true">✓</div>
    <h3 className="topic-confirmed-heading">Тему вибрано!</h3>
    <div className="topic-confirmed-name">{topic.title}</div>
    <dl className="topic-confirmed-details">
      {topic.description && (
        <>
          <dt>Опис</dt>
          <dd>{topic.description}</dd>
        </>
      )}
      {topic.supervisor && (
        <>
          <dt>Викладач</dt>
          <dd>{topic.supervisor}</dd>
        </>
      )}
      {topic.department && (
        <>
          <dt>Кафедра</dt>
          <dd>{topic.department}</dd>
        </>
      )}
      {studentName && (
        <>
          <dt>Студент</dt>
          <dd>{studentName}</dd>
        </>
      )}
    </dl>
    <p className="topic-confirmed-hint">
      {adminEmail
        ? <>Якщо потрібна зміна теми — пишіть на пошту <a href={`mailto:${adminEmail}`}>{adminEmail}</a></>
        : 'Якщо потрібна зміна теми — зверніться до адміністратора'}
    </p>
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

const SESSION_TOKEN_KEY = 'lit_session_token';
const getStoredToken = () => sessionStorage.getItem(SESSION_TOKEN_KEY) ?? '';
const setStoredToken = (t: string) => sessionStorage.setItem(SESSION_TOKEN_KEY, t);
const clearStoredToken = () => sessionStorage.removeItem(SESSION_TOKEN_KEY);

const authFetch = (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = getStoredToken();
  if (!token) return fetch(url, options);
  const existing = (options.headers ?? {}) as Record<string, string>;
  return fetch(url, {
    ...options,
    headers: { ...existing, Authorization: `Bearer ${token}` },
  });
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
  const [initializing, setInitializing] = useState(() => {
    if (typeof window === 'undefined') return false;
    return normalizePath(window.location.pathname) !== '/login';
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
  const [studentName, setStudentName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const topicConfirmBackButtonRef = useRef<HTMLButtonElement>(null);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState('');
  const [createError, setCreateError] = useState('');
  const [createNotice, setCreateNotice] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('');

  const [csvRows, setCsvRows] = useState<CsvStudent[]>([]);
  const [csvErrors, setCsvErrors] = useState<CsvError[]>([]);
  const [bulkErrors, setBulkErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [bulkCreated, setBulkCreated] = useState(0);
  const [bulkCredentials, setBulkCredentials] = useState<Array<{
    name: string;
    email: string;
    class: string;
    password: string;
    loginStatus: string;
  }>>([]);
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
  const [showAddTopicForm, setShowAddTopicForm] = useState(false);
  const [expandedAdminTopicId, setExpandedAdminTopicId] = useState('');
  const topicCsvInputRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [studentsSort, setStudentsSort] = useState<{ key: StudentsSortKey; direction: SortDirection }>({
    key: 'name',
    direction: 'asc',
  });
  const [topicsSort, setTopicsSort] = useState<{ key: TopicsSortKey; direction: SortDirection }>({
    key: 'title',
    direction: 'asc',
  });

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
      const response = await authFetch(apiUrl('/admin/users'), {
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
      const response = await authFetch(apiUrl('/topics'), {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        setStudentTopicsError(`Не вдалося завантажити список тем (${response.status})`);
        return;
      }

      const payload = (await response.json()) as StudentTopic[];
      setStudentTopics(payload || []);
    } catch (err) {
      setStudentTopicsError(`Не вдалося завантажити список тем (network: ${err instanceof Error ? err.message : String(err)})`);
    } finally {
      setStudentTopicsLoading(false);
    }
  };

  const loadTopics = async () => {
    setTopicsLoading(true);
    setTopicsError('');

    try {
      const response = await authFetch(apiUrl('/admin/topics'), {
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
      const response = await authFetch(apiUrl('/admin/audit'), {
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
    if (!initializing) return;
    void (async () => {
      try {
        const response = await authFetch(apiUrl('/auth/me'), {
          method: 'GET',
          credentials: 'include',
        });
        if (!response.ok) {
          navigate('/login');
          return;
        }
        const payload = (await response.json()) as LoginResponse;
        if (payload.role === 'student') {
          setSelectedTopic(payload.selectedTopic ?? null);
          setStudentName(payload.name || '');
          setAdminEmail(payload.adminEmail || '');
        }
      } catch {
        navigate('/login');
      } finally {
        setInitializing(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateViewportHeight = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-viewport-height', `${Math.round(viewportHeight)}px`);
    };

    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);
    window.visualViewport?.addEventListener('resize', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    if (initializing) return;
    if (route === '/admin') {
      void loadStudents();
      void loadTopics();
      void loadAudit();
    }
    if (route === '/topics') {
      void loadStudentTopics();
    }
  }, [route, initializing]);

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
      const response = await authFetch(apiUrl('/auth/login'), {
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

      const loginPayload = payload as LoginResponse;
      if (loginPayload.token) setStoredToken(loginPayload.token);
      if (loginPayload.role === 'admin') {
        setSelectedTopic(null);
        navigate('/admin');
      } else {
        setSelectedTopic(loginPayload.selectedTopic || null);
        setStudentName(loginPayload.name || '');
        setAdminEmail(loginPayload.adminEmail || '');
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
      await authFetch(apiUrl('/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      clearStoredToken();
      setSelectedTopic(null);
      setStudentName('');
      setAdminEmail('');
      setStudentTopics([]);
      setStudentTopicsError('');
      setStudentTopicActionError('');
      setRaceConditionAlert('');
      setTopicSearch('');
      setDebouncedTopicSearch('');
      setExpandedTopicId('');
      setTopicConfirmTarget(null);
      setStudents([]);
      setStudentsError('');
      setTopics([]);
      setTopicsError('');
      setAuditRows([]);
      setAuditError('');
      setCreateError('');
      setCreateNotice('');
      setCreatePassword('');
      setNewStudentName('');
      setNewStudentEmail('');
      setNewStudentClass('');
      setNewTopicTitle('');
      setNewTopicDescription('');
      setNewTopicSupervisor('');
      setNewTopicDepartment('');
      setCsvRows([]);
      setCsvErrors([]);
      setBulkCreated(0);
      setBulkCredentials([]);
      setTopicCsvRows([]);
      setTopicCsvErrors([]);
      setTopicBulkCreated(0);
      setReleaseTopicTargetId('');
      setReleaseTopicTitle('');
      setResetPasswordValue('');
      setAdminTab('status');
      setShowAddTopicForm(false);
      setExpandedAdminTopicId('');
      setStudentsSort({ key: 'name', direction: 'asc' });
      setTopicsSort({ key: 'title', direction: 'asc' });
      navigate('/login');
    }
  };

  const onCreateStudent = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError('');
    setCreateNotice('');
    setCreatePassword('');

    try {
      const response = await authFetch(apiUrl('/admin/users'), {
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
          loginStatus: created.loginStatus ?? 'not_logged_in',
          lastLoginAt: created.lastLoginAt ?? null,
        }),
      );
      setCreatePassword(created.newPassword);
      if (created.credentialEmailStatus === 'sent') {
        setCreateNotice('Лист із доступом надіслано студентові на email.');
      } else if (created.credentialEmailStatus === 'failed') {
        setCreateNotice('Студента створено, але лист не вдалося надіслати. Передайте пароль вручну.');
      } else if (created.credentialEmailStatus === 'disabled') {
        setCreateNotice('Студента створено. Email-розсилка наразі вимкнена.');
      }
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
      const response = await authFetch(apiUrl(`/admin/users/${studentId}`), {
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
      const response = await authFetch(apiUrl(`/admin/users/${studentId}/reset-password`), {
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
      const response = await authFetch(apiUrl('/admin/users/bulk'), {
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
      const credentialsWithStatus = payload.users.map((item) => ({
        ...item,
        loginStatus: item.loginStatus ?? 'не заходив',
      }));
      setBulkCreated(payload.created);
      setBulkErrors(payload.errors);
      setBulkCredentials(credentialsWithStatus);

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
              loginStatus: 'not_logged_in' as const,
              lastLoginAt: null,
            }));
          return [...prev, ...appended];
        });
        downloadCredentialsCsv(credentialsWithStatus);
        await loadStudents();
      }
    } catch {
      setCreateError('Не вдалося завантажити CSV');
    }
  };

  const downloadCredentialsCsv = (items: Array<{
    name: string;
    email: string;
    class: string;
    password: string;
    loginStatus: string;
  }>) => {
    if (items.length === 0) return;
    const csv = credentialsToCsv(items);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'student-credentials.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      const response = await authFetch(apiUrl('/admin/export/status'), {
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
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
      const response = await authFetch(apiUrl('/admin/export/audit'), {
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
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setExportAuditError('Не вдалося завантажити CSV аудиту');
    } finally {
      setExportAuditLoading(false);
    }
  };

  const onCreateTopic = async (event: FormEvent): Promise<boolean> => {
    event.preventDefault();
    setCreateTopicError('');

    try {
      const response = await authFetch(apiUrl('/admin/topics'), {
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
        return false;
      }

      const created = payload as CreateTopicResponse;
      setTopics((prev) => [...prev, created]);
      setNewTopicTitle('');
      setNewTopicDescription('');
      setNewTopicSupervisor('');
      setNewTopicDepartment('');
      return true;
    } catch {
      setCreateTopicError('Не вдалося додати тему');
      return false;
    }
  };

  const onDeleteTopic = async (topicId: string) => {
    setCreateTopicError('');
    try {
      const response = await authFetch(apiUrl(`/admin/topics/${topicId}`), {
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

    const result = await releaseTopicByAdmin(releaseTopicTargetId, authFetch);
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

    const result = await uploadTopicsCsv(topicCsvRows, authFetch);
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
      const response = await authFetch(apiUrl(`/topics/${topicConfirmTarget.id}/select`), {
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
          setRaceConditionAlert('Цю тему щойно вибрав інший учень.\nСписок оновлено — оберіть іншу тему.');
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

  const sortedStudents = useMemo(() => {
    const ordered = [...students];
    ordered.sort((left, right) => {
      let result = 0;
      if (studentsSort.key === 'name') result = compareText(left.name, right.name);
      if (studentsSort.key === 'email') result = compareText(left.email, right.email);
      if (studentsSort.key === 'class') result = compareText(left.class, right.class);
      if (studentsSort.key === 'hasSelectedTopic') result = Number(left.hasSelectedTopic) - Number(right.hasSelectedTopic);
      if (studentsSort.key === 'loginStatus') result = compareText(left.loginStatus, right.loginStatus);
      return studentsSort.direction === 'asc' ? result : -result;
    });
    return ordered;
  }, [students, studentsSort]);

  const sortedTopics = useMemo(() => {
    const ordered = [...topics];
    ordered.sort((left, right) => {
      let result = 0;
      if (topicsSort.key === 'title') result = compareText(left.title, right.title);
      if (topicsSort.key === 'supervisor') result = compareText(left.supervisor, right.supervisor);
      if (topicsSort.key === 'department') result = compareText(left.department, right.department);
      if (topicsSort.key === 'status') {
        const leftStatus = left.selectedBy ? 'зайнята' : 'вільна';
        const rightStatus = right.selectedBy ? 'зайнята' : 'вільна';
        result = compareText(leftStatus, rightStatus);
      }
      if (topicsSort.key === 'student') {
        const leftStudent = left.selectedBy
          ? `${left.selectedBy.name}${left.selectedBy.class ? ` (${left.selectedBy.class})` : ''}`
          : '';
        const rightStudent = right.selectedBy
          ? `${right.selectedBy.name}${right.selectedBy.class ? ` (${right.selectedBy.class})` : ''}`
          : '';
        result = compareText(leftStudent, rightStudent);
      }
      return topicsSort.direction === 'asc' ? result : -result;
    });
    return ordered;
  }, [topics, topicsSort]);

  const sortGlyph = (isActive: boolean, direction: SortDirection) => {
    if (!isActive) return '↕';
    return direction === 'asc' ? '↑' : '↓';
  };

  const studentLoginStatusLabel = (status: StudentRow['loginStatus']) => {
    return status === 'logged_in' ? 'Заходив' : 'Не заходив';
  };

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
              <div className="admin-panel-header">
                <h1 className="admin-title">Статус вибору тем</h1>
                <button type="button" className="admin-btn-muted admin-btn-logout" onClick={onLogout}>Вийти</button>
              </div>
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
                <button type="button" className="admin-btn-export" onClick={onExportTopicsStatus} disabled={exportStatusLoading}>
                  {exportStatusLoading ? 'Експорт...' : '⬇ Вивантажити CSV з вибраними темами'}
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
                <button type="button" className="admin-btn-muted admin-btn-logout" onClick={onLogout}>Вийти</button>
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
              {createNotice && <p className="secret">{createNotice}</p>}
              <ResetPasswordModal password={resetPasswordValue} onClose={() => setResetPasswordValue('')} />
              {createPassword && <p className="secret">Згенерований пароль: {createPassword}</p>}
              {studentsError && <p className="error">{studentsError}</p>}

              {studentsLoading ? (
                <p>Завантаження студентів...</p>
              ) : (
                <div className="admin-table">
                  <table className="students-table admin-students-table">
                    <thead>
                      <tr>
                        <th>
                          <button type="button" className="table-sort-btn" onClick={() => setStudentsSort((prev) => nextSort(prev, 'name'))}>
                            Ім'я
                            <span aria-hidden="true">{sortGlyph(studentsSort.key === 'name', studentsSort.direction)}</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" className="table-sort-btn" onClick={() => setStudentsSort((prev) => nextSort(prev, 'email'))}>
                            Email
                            <span aria-hidden="true">{sortGlyph(studentsSort.key === 'email', studentsSort.direction)}</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" className="table-sort-btn" onClick={() => setStudentsSort((prev) => nextSort(prev, 'class'))}>
                            Клас
                            <span aria-hidden="true">{sortGlyph(studentsSort.key === 'class', studentsSort.direction)}</span>
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            className="table-sort-btn"
                            onClick={() => setStudentsSort((prev) => nextSort(prev, 'hasSelectedTopic'))}
                          >
                            Тему обрано
                            <span aria-hidden="true">{sortGlyph(studentsSort.key === 'hasSelectedTopic', studentsSort.direction)}</span>
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            className="table-sort-btn"
                            onClick={() => setStudentsSort((prev) => nextSort(prev, 'loginStatus'))}
                          >
                            Статус логіну
                            <span aria-hidden="true">{sortGlyph(studentsSort.key === 'loginStatus', studentsSort.direction)}</span>
                          </button>
                        </th>
                        <th>Дії</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStudents.map((student) => (
                        <tr key={student.id}>
                          <td>{renderStackedName(student.name)}</td>
                          <td>{student.email}</td>
                          <td>{student.class}</td>
                          <td>{student.hasSelectedTopic ? 'Так' : 'Ні'}</td>
                          <td>
                            {studentLoginStatusLabel(student.loginStatus)}
                            {student.lastLoginAt && (
                              <span className="table-subtle">{new Date(student.lastLoginAt).toLocaleString('uk-UA')}</span>
                            )}
                          </td>
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
                </div>
              )}
            </section>
          )}

          {adminTab === 'topics' && (
            <section className="admin-panel">
              <div className="admin-panel-header">
                <h1 className="admin-title">Теми</h1>
                <div className="admin-panel-actions">
                  <button type="button" className="admin-btn-muted admin-btn-logout" onClick={onLogout}>Вийти</button>
                  <button type="button" className="admin-btn-muted" onClick={() => topicCsvInputRef.current?.click()}>
                    ⬆ CSV
                  </button>
                  <button
                    type="button"
                    className="admin-btn-add"
                    onClick={() => setShowAddTopicForm((v) => !v)}
                  >
                    {showAddTopicForm ? '✕ Скасувати' : '+ Додати тему'}
                  </button>
                </div>
              </div>

              {showAddTopicForm && (
                <form className="login-form" onSubmit={async (e) => { if (await onCreateTopic(e)) setShowAddTopicForm(false); }}>
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

                  <button type="submit">Зберегти тему</button>
                </form>
              )}

              <section className="bulk-box">
                <h3>Масове завантаження тем</h3>
                <input ref={topicCsvInputRef} type="file" accept=".csv,text/csv" onChange={onTopicCsvSelect} />

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

              {releaseTopicTitle && (
                <div className="topic-dialog-overlay">
                  <ReleaseTopicModal
                    topicTitle={releaseTopicTitle}
                    onConfirm={onConfirmReleaseTopic}
                    onCancel={() => {
                      setReleaseTopicTargetId('');
                      setReleaseTopicTitle('');
                    }}
                  />
                </div>
              )}

              {topicsLoading ? (
                <p>Завантаження тем...</p>
              ) : (
                <div className="admin-table">
                  <div className="admin-table-header">
                    <span className="admin-table-title">{`${totalTopicsCount} тем всього`}</span>
                  </div>
                  <table className="students-table admin-topics-table">
                    <thead>
                      <tr>
                        <th>
                          <button type="button" className="table-sort-btn" onClick={() => setTopicsSort((prev) => nextSort(prev, 'title'))}>
                            Назва теми
                            <span aria-hidden="true">{sortGlyph(topicsSort.key === 'title', topicsSort.direction)}</span>
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            className="table-sort-btn"
                            onClick={() => setTopicsSort((prev) => nextSort(prev, 'supervisor'))}
                          >
                            Викладач
                            <span aria-hidden="true">{sortGlyph(topicsSort.key === 'supervisor', topicsSort.direction)}</span>
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            className="table-sort-btn"
                            onClick={() => setTopicsSort((prev) => nextSort(prev, 'department'))}
                          >
                            Кафедра
                            <span aria-hidden="true">{sortGlyph(topicsSort.key === 'department', topicsSort.direction)}</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" className="table-sort-btn" onClick={() => setTopicsSort((prev) => nextSort(prev, 'status'))}>
                            Статус
                            <span aria-hidden="true">{sortGlyph(topicsSort.key === 'status', topicsSort.direction)}</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" className="table-sort-btn" onClick={() => setTopicsSort((prev) => nextSort(prev, 'student'))}>
                            Студент
                            <span aria-hidden="true">{sortGlyph(topicsSort.key === 'student', topicsSort.direction)}</span>
                          </button>
                        </th>
                        <th>Дії</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTopics.map((topic) => (
                        <Fragment key={topic.id}>
                          <tr>
                            <td>
                              <button
                                type="button"
                                className="admin-topic-expand-btn"
                                onClick={() => setExpandedAdminTopicId((prev) => (prev === topic.id ? '' : topic.id))}
                                aria-expanded={expandedAdminTopicId === topic.id}
                              >
                                <span className="admin-topic-expand-icon">{expandedAdminTopicId === topic.id ? '▾' : '▸'}</span>
                                {topic.title}
                              </button>
                            </td>
                            <td>{topic.supervisor ? renderStackedName(topic.supervisor) : '—'}</td>
                            <td>{topic.department ? renderStackedName(topic.department) : '—'}</td>
                            <td>
                              <span className={`badge ${topic.selectedBy ? 'badge-taken' : 'badge-free'}`}>
                                {topic.selectedBy ? 'зайнята' : 'вільна'}
                              </span>
                            </td>
                            <td>
                              {topic.selectedBy ? (
                                <span className="student-cell">
                                  {renderStackedName(topic.selectedBy.name)}
                                  {topic.selectedBy.class && <span className="student-cell-class">{topic.selectedBy.class}</span>}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="table-actions table-actions--topics">
                              <button type="button" className="table-action-btn table-action-btn-danger" onClick={() => onDeleteTopic(topic.id)}>
                                Видалити
                              </button>
                              {topic.selectedBy && (
                                <button type="button" className="table-action-btn table-action-btn-soft" onClick={() => onOpenReleaseTopicModal(topic)}>
                                  Звільнити
                                </button>
                              )}
                            </td>
                          </tr>
                          {expandedAdminTopicId === topic.id && (
                            <tr className="admin-topic-details-row">
                              <td colSpan={6}>
                                <dl className="admin-topic-details">
                                  {topic.description && (
                                    <>
                                      <dt>Опис</dt>
                                      <dd>{topic.description}</dd>
                                    </>
                                  )}
                                </dl>
                              </td>
                            </tr>
                          )}
                        </Fragment>
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
                <div className="admin-panel-actions">
                  <button type="button" className="admin-btn-muted admin-btn-logout" onClick={onLogout}>Вийти</button>
                  <button type="button" onClick={onExportAuditLog} disabled={exportAuditLoading}>
                    {exportAuditLoading ? 'Експорт...' : '⬇ Вивантажити CSV'}
                  </button>
                </div>
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

        {selectedTopic ? (
          <TopicConfirmedScreen topic={selectedTopic} studentName={studentName} adminEmail={adminEmail} />
        ) : (
          <>
            <section className="student-topics">
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

              {(initializing || studentTopicsLoading) && (
                <div className="topic-skeletons" aria-label="Завантаження тем">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="topic-skeleton-row" />
                  ))}
                </div>
              )}

              {!studentTopicsLoading && !studentTopicsError && studentTopics.length === 0 && (
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

              <TopicConfirmDialog
                topic={topicConfirmTarget}
                pending={topicSelectPending}
                backButtonRef={topicConfirmBackButtonRef}
                adminEmail={adminEmail}
                onCancel={() => setTopicConfirmTarget(null)}
                onConfirm={onConfirmTopicSelect}
              />
            </section>
            <RaceConditionModal message={raceConditionAlert} onClose={() => setRaceConditionAlert('')} />
          </>
        )}
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
        <div className="password-wrap">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Сховати пароль' : 'Показати пароль'}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Вхід...' : 'Увійти'}
        </button>
      </form>
    </main>
  );
}

export default App;
