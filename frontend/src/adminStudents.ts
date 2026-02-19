export type StudentRow = {
  id: string;
  name: string;
  email: string;
  hasSelectedTopic: boolean;
};

export const addStudentToList = (list: StudentRow[], student: StudentRow): StudentRow[] => {
  return [...list, student];
};

export const removeStudentFromList = (list: StudentRow[], id: string): StudentRow[] => {
  return list.filter((student) => student.id !== id);
};
