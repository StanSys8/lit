import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

describe('App login screen', () => {
  it('renders login form', () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('Login');
    expect(html).toContain('Email');
    expect(html).toContain('Password');
    expect(html).toContain('Sign in');
  });
});
