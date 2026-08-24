import { q } from '../statementCache';
import { newId } from '@/lib/id';
import { nowIso } from '../db';
import type { User, Role, PublicUser } from '@/types/models';

export function toPublicUser(u: User): PublicUser {
  const { password_hash, ...rest } = u;
  return rest;
}

export function createUser(input: {
  role: Role;
  email: string;
  password_hash: string;
  name: string;
  phone?: string | null;
}): User {
  const id = newId('usr');
  const created_at = nowIso();
  q(
    `INSERT INTO users (id, role, email, password_hash, name, phone, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.role, input.email.toLowerCase().trim(), input.password_hash, input.name, input.phone ?? null, created_at);
  return getUserById(id)!;
}

export function getUserById(id: string): User | undefined {
  return q('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function getUserByEmail(email: string): User | undefined {
  return q('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as User | undefined;
}

export function listUsersByRole(role: Role): User[] {
  return q('SELECT * FROM users WHERE role = ? ORDER BY created_at DESC').all(role) as User[];
}

export function listAllUsers(): User[] {
  return q('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
}
