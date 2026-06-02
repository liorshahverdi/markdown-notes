import { writable } from 'svelte/store';

export interface UserInfo {
  id: string;
  username: string;
}

export const currentUser = writable<UserInfo | null>(null);

export async function logout(): Promise<void> {
  await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'logout' }),
  });
  currentUser.set(null);
  window.location.href = '/login';
}
