import Papa from 'papaparse';

export type CsvStudent = { name: string; email: string; class: string };
export type CsvError = { row: number; message: string };

export const parseStudentsCsv = (text: string): { rows: CsvStudent[]; errors: CsvError[] } => {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const headerFields = parsed.meta.fields ?? [];
  if (!headerFields.includes('name') || !headerFields.includes('email') || !headerFields.includes('class')) {
    return {
      rows: [],
      errors: [{ row: 1, message: 'CSV must contain name,email,class header' }],
    };
  }

  const rows: CsvStudent[] = [];
  const errors: CsvError[] = [];

  parsed.data.forEach((item, index) => {
    const name = String(item.name ?? '').trim();
    const email = String(item.email ?? '').trim();
    const className = String(item.class ?? '').trim();
    if (!name && !email && !className) {
      return;
    }

    if (!name || !email || !className) {
      errors.push({ row: index + 2, message: 'name, email and class are required' });
      return;
    }
    rows.push({ name, email, class: className });
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

export const credentialsToCsv = (items: Array<{ name: string; email: string; class: string; password: string }>): string => {
  return Papa.unparse(items, {
    columns: ['name', 'email', 'class', 'password'],
  });
};
