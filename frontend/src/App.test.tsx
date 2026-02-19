import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App, { ReleaseTopicModal, ResetPasswordModal, StudentActions } from './App';

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
  });

  it('renders admin students page with add/delete and bulk controls on /admin', () => {
    const html = withPath('/admin', () => renderToStaticMarkup(<App />));
    expect(html).toContain('Admin Dashboard');
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
});
