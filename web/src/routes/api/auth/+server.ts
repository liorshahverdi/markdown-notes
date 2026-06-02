import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  findUserByUsername,
  createUser,
  verifyPassword,
  createSession,
  deleteSession,
} from '$lib/server/auth';

function cookieOpts(url: URL) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: url.protocol === 'https:',
    maxAge: 7 * 24 * 60 * 60,
  };
}

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  const body = await request.json();
  const { action, username, password } = body as {
    action: string;
    username?: string;
    password?: string;
  };

  if (action === 'signup') {
    if (!username || !password) {
      return json({ error: 'Username and password required' }, { status: 400 });
    }
    if (username.length < 2 || username.length > 32) {
      return json({ error: 'Username must be 2-32 characters' }, { status: 400 });
    }
    if (password.length < 4) {
      return json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }
    try {
      const user = await createUser(username.trim(), password);
      const token = createSession(user.id);
      cookies.set('session', token, cookieOpts(url));
      return json({ user: { id: user.id, username: user.username } });
    } catch (err: any) {
      return json({ error: err.message }, { status: 409 });
    }
  }

  if (action === 'login') {
    if (!username || !password) {
      return json({ error: 'Username and password required' }, { status: 400 });
    }
    const user = findUserByUsername(username.trim());
    if (!user || !(await verifyPassword(user, password))) {
      return json({ error: 'Invalid username or password' }, { status: 401 });
    }
    const token = createSession(user.id);
    cookies.set('session', token, cookieOpts(url));
    return json({ user: { id: user.id, username: user.username } });
  }

  if (action === 'logout') {
    const token = cookies.get('session');
    if (token) {
      deleteSession(token);
      cookies.delete('session', { path: '/' });
    }
    return json({ ok: true });
  }

  return json({ error: 'Unknown action' }, { status: 400 });
};
