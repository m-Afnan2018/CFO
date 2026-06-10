import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();
const COOKIE = 'cfo_auth';

function secret() {
  return process.env.JWT_SECRET || 'fallback-secret-change-this';
}

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (
    username !== (process.env.AUTH_USERNAME || 'admin') ||
    password !== (process.env.AUTH_PASSWORD || 'admin123')
  ) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ username }, secret(), { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  res.json({ ok: true });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', (req: Request, res: Response) => {
  const cookies = (req as Request & { cookies: Record<string, string> }).cookies;
  const token = cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, secret()) as { username: string };
    res.json({ username: payload.username });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
