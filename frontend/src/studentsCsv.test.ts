import { describe, expect, it } from 'vitest';
import { credentialsToCsv, parseStudentsCsv } from './studentsCsv';

describe('studentsCsv helpers', () => {
  it('parses valid name,email CSV', () => {
    const input = ['name,email', 'Alice,alice@example.com', 'Bob,bob@example.com'].join('\n');
    const result = parseStudentsCsv(input);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].name).toBe('Alice');
  });

  it('returns header error when columns missing', () => {
    const result = parseStudentsCsv('title,email\nX,x@example.com');
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0].message).toContain('name,email');
  });

  it('generates credentials CSV', () => {
    const csv = credentialsToCsv([{ name: 'A', email: 'a@example.com', password: 'p1' }]);
    expect(csv).toContain('name,email,password');
    expect(csv).toContain('a@example.com');
  });

  it('parses quoted values via Papa.parse', () => {
    const input = ['name,email', '"Alice, A.","alice@example.com"'].join('\n');
    const result = parseStudentsCsv(input);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0].name).toBe('Alice, A.');
  });
});
