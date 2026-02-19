import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

const withPath = (pathname: string, render: () => string) => {
  const previous = globalThis.window;
  // Minimal browser-like object for route initialization in SSR tests.
  globalThis.window = { location: { pathname } } as unknown as Window & typeof globalThis;
  try {
    return render();
  } finally {
    globalThis.window = previous;
  }
};

describe('App login screen', () => {
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

  it('renders admin sidebar logout control on /admin', () => {
    const html = withPath('/admin', () => renderToStaticMarkup(<App />));
    expect(html).toContain('Admin Dashboard');
    expect(html).toContain('Logout');
    expect(html).toContain('<aside');
  });
});
