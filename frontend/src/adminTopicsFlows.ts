import { apiUrl } from './apiBase';

export type CsvTopicRow = {
  title: string;
  description: string;
  supervisor: string;
  department: string;
};

export type TopicRow = {
  id: string;
  title: string;
  description: string;
  supervisor: string;
  department: string;
  selectedBy: { id: string; name: string; class: string } | null;
};

export type TopicsBulkResponse = {
  created: number;
  errors: Array<{ row: number; message: string }>;
};

type FetchLike = typeof fetch;

export const uploadTopicsCsv = async (
  rows: CsvTopicRow[],
  fetchImpl: FetchLike = fetch,
): Promise<{ ok: true; payload: TopicsBulkResponse } | { ok: false; message: string }> => {
  try {
    const response = await fetchImpl(apiUrl('/admin/topics/bulk'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(rows),
    });

    if (!response.ok) {
      return { ok: false, message: 'Failed to upload topics CSV' };
    }

    const payload = (await response.json()) as TopicsBulkResponse;
    return { ok: true, payload };
  } catch {
    return { ok: false, message: 'Failed to upload topics CSV' };
  }
};

export const releaseTopicByAdmin = async (
  topicId: string,
  fetchImpl: FetchLike = fetch,
): Promise<
  | { ok: true; topic: TopicRow }
  | { ok: false; status: number; error?: string; message: string }
> => {
  try {
    const response = await fetchImpl(apiUrl(`/admin/topics/${topicId}/release`), {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      const payload = (await response.json()) as { topic: TopicRow };
      return { ok: true, topic: payload.topic };
    }

    const payload = (await response.json()) as { error?: string; message?: string };
    return {
      ok: false,
      status: response.status,
      error: payload.error,
      message: payload.message || 'Failed to release topic',
    };
  } catch {
    return { ok: false, status: 0, message: 'Failed to release topic' };
  }
};
