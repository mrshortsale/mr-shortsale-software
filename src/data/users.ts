export type UserRole = 'ceo' | 'rep';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarColor: string;
}

export const users: User[] = [
  { id: 'u1', email: 'cristina@mrshortsale.net', name: 'Cristina Gaspar', role: 'ceo', avatarColor: '#042C53' },
  { id: 'u2', email: 'maria@mrshortsale.net', name: 'Maria Santos', role: 'rep', avatarColor: '#0F6E56' },
  { id: 'u3', email: 'james@mrshortsale.net', name: 'James Rivera', role: 'rep', avatarColor: '#185FA5' },
  { id: 'u4', email: 'luis@mrshortsale.net', name: 'Luis Ortega', role: 'rep', avatarColor: '#854F0B' },
];

export function authenticateUser(email: string, password: string): User | null {
  if (password !== 'demo2026') return null;
  return users.find(u => u.email === email.toLowerCase()) || null;
}
