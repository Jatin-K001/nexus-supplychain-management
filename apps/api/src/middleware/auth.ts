import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../supabase';
import { pool } from '../db';
import type { Role } from '@nexus/shared-types';

export interface AuthedRequest extends Request {
  user?: { id: string; role: Role; full_name: string };
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  const token = header.slice('Bearer '.length);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  const profileRes = await pool.query('select id, role, full_name from profiles where id = $1', [data.user.id]);
  if (profileRes.rowCount === 0) {
    return res.status(403).json({ error: 'No profile for this account' });
  }
  req.user = profileRes.rows[0];
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}
