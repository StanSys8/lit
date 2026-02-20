import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App, {
  AdminStatCard,
  ReleaseTopicModal,
  ResetPasswordModal,
  StudentActions,
  TopicAccordionItem,
  TopicConfirmDialog,
  TopicConfirmedScreen,
} from './App';

const withPath = (pathname: string, render: () => string) => {
  const previous = globalThis.window;
  globalThis.window = { location: { pathname } } as unknown as Window & typeof globalThis;
  try {
    return render();
  } finally {
    globalThis.window = previous;
  }
};

describe('App routes', () => {
  it('renders login form', () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('Login');
    expect(html).toContain('Email');
    expect(html).toContain('Password');
    expect(html).toContain('Sign in');
  });

  it('renders student header logout control on /topics', () => {
    const html = withPath('/topics', () => renderToStaticMarkup(<App />));
    expect(html).toContain('Student Topics');
    expect(html).toContain('Logout');
    expect(html).toContain('<header');
    expect(html).toContain('Пошук теми');
    expect(html).toContain('Всі теми вже вибрані. Зверніться до вчителя.');
  });

  it('renders admin students page with add/delete and bulk controls on /admin', () => {
    const html = withPath('/admin', () => renderToStaticMarkup(<App />));
    expect(html).toContain('Admin Dashboard');
    expect(html).toContain('Статус вибору тем');
    expect(html).toContain('0 / 0 студентів вибрали тему');
    expect(html).toContain('0 вільних тем з 0 загалом');
    expect(html).toContain('Завантажити CSV статусу');
    expect(html).toContain('Students');
    expect(html).toContain('Topics');
    expect(html).toContain('Add student');
    expect(html).toContain('Add topic');
    expect(html).toContain('Bulk upload topics');
    expect(html).toContain('Actions');
    expect(html).toContain('Bulk upload students');
    expect(html).toContain('type="file"');
    expect(html).toContain('<aside');
    expect(html).toContain('Name');
    expect(html).toContain('Email');
    expect(html).toContain('Title');
    expect(html).toContain('Description');
    expect(html).toContain('Supervisor');
    expect(html).toContain('Department');
    expect(html).toContain('Журнал дій');
    expect(html).toContain('Час');
    expect(html).toContain('Actor');
    expect(html).toContain('Action');
    expect(html).toContain('Result');
  });
});

describe('Admin reset controls', () => {
  it('renders reset action button for student row actions', () => {
    const html = renderToStaticMarkup(
      <StudentActions studentId="student-1" onDelete={() => {}} onResetPassword={() => {}} />,
    );
    expect(html).toContain('Delete');
    expect(html).toContain('Скинути пароль');
  });

  it('renders one-time password modal content when password exists', () => {
    const html = renderToStaticMarkup(<ResetPasswordModal password="secret-123" onClose={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Нове значення пароля');
    expect(html).toContain('secret-123');
    expect(html).toContain('Закрити');
  });

  it('renders release topic confirmation modal', () => {
    const html = renderToStaticMarkup(
      <ReleaseTopicModal topicTitle="Topic A" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(html).toContain('Підтвердження звільнення теми');
    expect(html).toContain('Звільнити тему &quot;Topic A&quot;?');
    expect(html).toContain('Підтвердити');
    expect(html).toContain('Скасувати');
  });

  it('renders topic accordion expanded content and select button classes', () => {
    const html = renderToStaticMarkup(
      <TopicAccordionItem
        topic={{
          id: 'topic-1',
          title: 'Distributed Systems',
          description: 'Event sourcing',
          supervisor: 'Dr. Smith',
          department: 'CS',
        }}
        expanded
        onToggle={() => {}}
        onSelectTopic={() => {}}
      />,
    );
    expect(html).toContain('Distributed Systems');
    expect(html).toContain('Науковий керівник: Dr. Smith');
    expect(html).toContain('Кафедра: CS');
    expect(html).toContain('Вибрати цю тему');
    expect(html).toContain('border-l-4');
    expect(html).toContain('border-[#B436F0]');
  });

  it('renders topic confirm dialog content and actions', () => {
    const html = renderToStaticMarkup(
      <TopicConfirmDialog
        topic={{
          id: 'topic-1',
          title: 'Distributed Systems',
          description: 'Event sourcing',
          supervisor: 'Dr. Smith',
          department: 'CS',
        }}
        pending={false}
        backButtonRef={{ current: null }}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(html).toContain('Підтвердження вибору теми');
    expect(html).toContain('Ти вибираєш: Distributed Systems.');
    expect(html).toContain('Назад до списку');
    expect(html).toContain('Так, беру цю тему');
  });

  it('renders topic confirmed screen', () => {
    const html = renderToStaticMarkup(
      <TopicConfirmedScreen
        topic={{
          id: 'topic-1',
          title: 'Distributed Systems',
          description: 'Event sourcing',
          supervisor: 'Dr. Smith',
          department: 'CS',
        }}
      />,
    );
    expect(html).toContain('Тему вибрано!');
    expect(html).toContain('Distributed Systems');
    expect(html).toContain('звернись до вчителя');
  });

  it('renders admin stat card in primary variant', () => {
    const html = renderToStaticMarkup(
      <AdminStatCard
        title="Статус вибору тем"
        value="10 / 10 студентів вибрали тему"
        subtitle="Прогрес вибору тем"
        progressPercent={100}
        variant="primary"
      />,
    );
    expect(html).toContain('Статус вибору тем');
    expect(html).toContain('10 / 10 студентів вибрали тему');
    expect(html).toContain('border-[#B436F0]');
    expect(html).toContain('progressbar');
  });
});
