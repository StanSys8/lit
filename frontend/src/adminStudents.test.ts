import { describe, expect, it } from 'vitest';
import { addStudentToList, removeStudentFromList, type StudentRow } from './adminStudents';

describe('admin students helpers', () => {
  it('adds student to list', () => {
    const initial: StudentRow[] = [
      {
        id: '1',
        name: 'A',
        email: 'a@example.com',
        class: '9-A',
        hasSelectedTopic: false,
        loginStatus: 'not_logged_in',
        lastLoginAt: null,
      },
    ];
    const result = addStudentToList(initial, {
      id: '2',
      name: 'B',
      email: 'b@example.com',
      class: '9-B',
      hasSelectedTopic: true,
      loginStatus: 'logged_in',
      lastLoginAt: '2026-02-23T08:00:00.000Z',
    });

    expect(result).toHaveLength(2);
    expect(result[1].id).toBe('2');
  });

  it('removes student by id', () => {
    const initial: StudentRow[] = [
      {
        id: '1',
        name: 'A',
        email: 'a@example.com',
        class: '9-A',
        hasSelectedTopic: false,
        loginStatus: 'not_logged_in',
        lastLoginAt: null,
      },
      {
        id: '2',
        name: 'B',
        email: 'b@example.com',
        class: '9-B',
        hasSelectedTopic: false,
        loginStatus: 'not_logged_in',
        lastLoginAt: null,
      },
    ];

    const result = removeStudentFromList(initial, '1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });
});
