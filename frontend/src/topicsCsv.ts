import Papa from 'papaparse';
import type { CsvError } from './studentsCsv';

export type CsvTopic = {
  title: string;
  description: string;
  supervisor: string;
  department: string;
};

export const parseTopicsCsv = (text: string): { rows: CsvTopic[]; errors: CsvError[] } => {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const headerFields = parsed.meta.fields ?? [];
  const required = ['title', 'description', 'supervisor', 'department'];
  const hasAllHeaders = required.every((field) => headerFields.includes(field));
  if (!hasAllHeaders) {
    return {
      rows: [],
      errors: [{ row: 1, message: 'CSV must contain title,description,supervisor,department header' }],
    };
  }

  const rows: CsvTopic[] = [];
  const errors: CsvError[] = [];

  parsed.data.forEach((item, index) => {
    const title = String(item.title ?? '').trim();
    const description = String(item.description ?? '').trim();
    const supervisor = String(item.supervisor ?? '').trim();
    const department = String(item.department ?? '').trim();

    if (!title || !supervisor) {
      errors.push({ row: index + 2, message: 'title and supervisor are required' });
      return;
    }

    rows.push({
      title,
      description,
      supervisor,
      department,
    });
  });

  if (parsed.errors.length > 0) {
    parsed.errors.forEach((err) => {
      errors.push({
        row: (err.row ?? 0) + 2,
        message: err.message,
      });
    });
  }

  return { rows, errors };
};
