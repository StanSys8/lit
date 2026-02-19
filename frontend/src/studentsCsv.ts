import Papa from 'papaparse';

export type CsvStudent = { name: string; email: string };
export type CsvError = { row: number; message: string };

export const parseStudentsCsv = (text: string): { rows: CsvStudent[]; errors: CsvError[] } => {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const headerFields = parsed.meta.fields ?? [];
  if (!headerFields.includes('name') || !headerFields.includes('email')) {
    return {
      rows: [],
      errors: [{ row: 1, message: 'CSV must contain name,email header' }],
    };
  }

  const rows: CsvStudent[] = [];
  const errors: CsvError[] = [];

  parsed.data.forEach((item, index) => {
    const name = String(item.name ?? '').trim();
    const email = String(item.email ?? '').trim();
    if (!name || !email) {
      errors.push({ row: index + 2, message: 'name and email are required' });
      return;
    }
    rows.push({ name, email });
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

export const credentialsToCsv = (items: Array<{ name: string; email: string; password: string }>): string => {
  return Papa.unparse(items, {
    columns: ['name', 'email', 'password'],
  });
};
