import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import type { User } from '@/types';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
const AUTH_DISABLED = process.env.AUTH_DISABLED === 'true';

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function getCurrentUser(): Promise<User | null> {
  if (AUTH_DISABLED) {
    return {
      id: 'dev-user',
      email: 'dev@localhost',
      name: 'Development User',
      isAdmin: true,
    };
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return null;
  }

  return {
    id: session.user.email,
    email: session.user.email,
    name: session.user.name || 'User',
    image: session.user.image || undefined,
    isAdmin: isAdmin(session.user.email),
  };
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();
  if (!user.isAdmin) {
    throw new Error('Admin access required');
  }
  return user;
}
