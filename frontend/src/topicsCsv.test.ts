import { describe, expect, it } from 'vitest';
import { parseTopicsCsv } from './topicsCsv';

describe('topicsCsv', () => {
  it('parses valid topics CSV', () => {
    const input =
      'title,description,supervisor,department\nTopic A,Desc A,Dr. A,CS\nTopic B,Desc B,Dr. B,SE';
    const result = parseTopicsCsv(input);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      title: 'Topic A',
      description: 'Desc A',
      supervisor: 'Dr. A',
      department: 'CS',
    });
  });

  it('returns header error for invalid columns', () => {
    const result = parseTopicsCsv('name,email\nX,x@example.com');
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0].message).toContain('title,description,supervisor,department');
  });

  it('rejects rows without title or supervisor', () => {
    const input =
      'title,description,supervisor,department\n,Desc A,Dr. A,CS\nTopic B,Desc B,,SE\nTopic C,Desc C,Dr. C,DS';
    const result = parseTopicsCsv(input);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].title).toBe('Topic C');
    expect(result.errors).toHaveLength(2);
  });

  it('skips completely empty rows', () => {
    const input =
      'title,description,supervisor,department\nTopic A,Desc A,Dr. A,CS\n,,,\nTopic B,Desc B,Dr. B,SE';
    const result = parseTopicsCsv(input);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
  });
});
