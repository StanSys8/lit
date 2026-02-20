import { describe, expect, it } from 'vitest';
import { credentialsToCsv, parseStudentsCsv } from './studentsCsv';

describe('studentsCsv helpers', () => {
  it('parses valid name,email,class CSV', () => {
    const input = ['name,email,class', 'Alice,alice@example.com,9-A', 'Bob,bob@example.com,9-B'].join('\n');
    const result = parseStudentsCsv(input);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].name).toBe('Alice');
    expect(result.rows[0].class).toBe('9-A');
  });

  it('returns header error when columns missing', () => {
    const result = parseStudentsCsv('title,email\nX,x@example.com');
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0].message).toContain('name,email,class');
  });

  it('generates credentials CSV', () => {
    const csv = credentialsToCsv([{ name: 'A', email: 'a@example.com', class: '9-A', password: 'p1' }]);
    expect(csv).toContain('name,email,class,password');
    expect(csv).toContain('a@example.com');
    expect(csv).toContain('9-A');
  });

  it('parses quoted values via Papa.parse', () => {
    const input = ['name,email,class', '"Alice, A.","alice@example.com","9-A"'].join('\n');
    const result = parseStudentsCsv(input);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0].name).toBe('Alice, A.');
  });

  it('skips completely empty rows', () => {
    const input = ['name,email,class', 'Alice,alice@example.com,9-A', ',,', 'Bob,bob@example.com,9-B'].join('\n');
    const result = parseStudentsCsv(input);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
  });
});
