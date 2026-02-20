import { describe, expect, it, vi } from 'vitest';
import { releaseTopicByAdmin, uploadTopicsCsv } from './adminTopicsFlows';

const mockJsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

describe('adminTopicsFlows', () => {
  it('uploads topics CSV and returns created/errors payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse(200, {
        created: 1,
        errors: [{ row: 2, message: 'title and supervisor are required' }],
      }),
    );

    const result = await uploadTopicsCsv(
      [
        { title: 'Topic A', description: 'Desc A', supervisor: 'Dr. A', department: 'CS' },
        { title: '', description: 'Desc B', supervisor: 'Dr. B', department: 'SE' },
      ],
      fetchMock as unknown as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/admin/topics/bulk',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual({
      ok: true,
      payload: {
        created: 1,
        errors: [{ row: 2, message: 'title and supervisor are required' }],
      },
    });
  });

  it('returns error when topics CSV upload fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(400, { error: 'VALIDATION_ERROR' }));
    const result = await uploadTopicsCsv([], fetchMock as unknown as typeof fetch);
    expect(result).toEqual({ ok: false, message: 'Failed to upload topics CSV' });
  });

  it('releases selected topic and returns updated topic payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse(200, {
        topic: {
          id: 'topic-1',
          title: 'Distributed Systems',
          description: 'Event sourcing',
          supervisor: 'Dr. Smith',
          department: 'CS',
          selectedBy: null,
        },
      }),
    );

    const result = await releaseTopicByAdmin('topic-1', fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledWith(
      '/admin/topics/topic-1/release',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual({
      ok: true,
      topic: {
        id: 'topic-1',
        title: 'Distributed Systems',
        description: 'Event sourcing',
        supervisor: 'Dr. Smith',
        department: 'CS',
        selectedBy: null,
      },
    });
  });

  it('maps release conflict and not-found responses', async () => {
    const conflictFetch = vi
      .fn()
      .mockResolvedValue(mockJsonResponse(409, { error: 'TOPIC_ALREADY_FREE', message: 'Тема вже вільна' }));
    const notFoundFetch = vi.fn().mockResolvedValue(mockJsonResponse(404, { error: 'NOT_FOUND', message: 'Topic not found' }));

    const conflict = await releaseTopicByAdmin('topic-1', conflictFetch as unknown as typeof fetch);
    const missing = await releaseTopicByAdmin('missing', notFoundFetch as unknown as typeof fetch);

    expect(conflict).toEqual({
      ok: false,
      status: 409,
      error: 'TOPIC_ALREADY_FREE',
      message: 'Тема вже вільна',
    });
    expect(missing).toEqual({
      ok: false,
      status: 404,
      error: 'NOT_FOUND',
      message: 'Topic not found',
    });
  });
});
