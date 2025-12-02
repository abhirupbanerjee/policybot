import path from 'path';
import { readJson, writeJson, getDataDir } from './storage';

export interface AllowedUser {
  email: string;
  name?: string;
  role: 'admin' | 'user';
  addedAt: Date;
  addedBy: string;
}

interface UserRegistry {
  users: AllowedUser[];
}

function getUsersFilePath(): string {
  return path.join(getDataDir(), 'allowed-users.json');
}

export async function getAllowedUsers(): Promise<AllowedUser[]> {
  const filePath = getUsersFilePath();
  const registry = await readJson<UserRegistry>(filePath);

  if (!registry) {
    // Initialize with admin emails from env
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0);

    const initialUsers: AllowedUser[] = adminEmails.map(email => ({
      email,
      role: 'admin' as const,
      addedAt: new Date(),
      addedBy: 'system',
    }));

    await writeJson(filePath, { users: initialUsers });
    return initialUsers;
  }

  return registry.users.map(u => ({
    ...u,
    addedAt: new Date(u.addedAt),
  }));
}

export async function isUserAllowed(email: string): Promise<boolean> {
  if (!email) return false;
  const users = await getAllowedUsers();
  return users.some(u => u.email.toLowerCase() === email.toLowerCase());
}

export async function getUserRole(email: string): Promise<'admin' | 'user' | null> {
  if (!email) return null;
  const users = await getAllowedUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  return user?.role || null;
}

export async function addAllowedUser(
  email: string,
  role: 'admin' | 'user',
  addedBy: string,
  name?: string
): Promise<AllowedUser> {
  const users = await getAllowedUsers();

  // Check if already exists
  const existingIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

  const newUser: AllowedUser = {
    email: email.toLowerCase(),
    name,
    role,
    addedAt: new Date(),
    addedBy,
  };

  if (existingIndex >= 0) {
    // Update existing user
    users[existingIndex] = newUser;
  } else {
    users.push(newUser);
  }

  await writeJson(getUsersFilePath(), { users });
  return newUser;
}

export async function removeAllowedUser(email: string): Promise<boolean> {
  const users = await getAllowedUsers();
  const filteredUsers = users.filter(u => u.email.toLowerCase() !== email.toLowerCase());

  if (filteredUsers.length === users.length) {
    return false; // User not found
  }

  await writeJson(getUsersFilePath(), { users: filteredUsers });
  return true;
}

export async function updateUserRole(email: string, role: 'admin' | 'user'): Promise<boolean> {
  const users = await getAllowedUsers();
  const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

  if (userIndex < 0) {
    return false;
  }

  users[userIndex].role = role;
  await writeJson(getUsersFilePath(), { users });
  return true;
}
