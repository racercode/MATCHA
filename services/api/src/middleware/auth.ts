import type { Request, Response, NextFunction } from 'express'
import { govStaff } from '../lib/store.js'

export interface AuthedRequest extends Request {
  uid: string
  role: 'citizen' | 'gov_staff'
  govId?: string
}

// Token = raw uid string (no Firebase verification)
export function verifyToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '未提供 token', data: null })
    return
  }

  const uid = header.slice(7).trim()
  if (!uid) {
    res.status(401).json({ success: false, error: 'token 無效', data: null })
    return
  }

  const authed = req as AuthedRequest
  authed.uid = uid

  const staff = govStaff.get(uid)
  if (staff) {
    authed.role = 'gov_staff'
    authed.govId = staff.govId
  } else {
    authed.role = 'citizen'
  }

  next()
}

export function requireGovStaff(req: Request, res: Response, next: NextFunction) {
  if ((req as AuthedRequest).role !== 'gov_staff') {
    res.status(403).json({ success: false, error: '權限不足', data: null })
    return
  }
  next()
}
