import type { Request, Response, NextFunction } from 'express'
import { auth, db } from '../lib/firebase.js'

export interface AuthedRequest extends Request {
  uid: string
  role: 'citizen' | 'gov_staff'
  govId?: string
}

export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '未提供 token', data: null })
    return
  }

  const idToken = header.slice(7).trim()
  if (!idToken) {
    res.status(401).json({ success: false, error: 'token 無效', data: null })
    return
  }

  if (process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_AUTH === 'true') {
    const authed = req as AuthedRequest
    authed.uid = idToken
    authed.role = 'gov_staff'
    authed.govId = 'test-gov'
    next()
    return
  }

  try {
    const decoded = await auth.verifyIdToken(idToken)
    const uid = decoded.uid
    const authed = req as AuthedRequest
    authed.uid = uid

    const staffSnap = await db.collection('gov_staff').where('uid', '==', uid).limit(1).get()
    const staffDoc = staffSnap.docs[0]
    if (staffDoc) {
      authed.role = 'gov_staff'
      authed.govId = staffDoc.data().govId as string
    } else {
      authed.role = 'citizen'
    }

    next()
  } catch {
    res.status(401).json({ success: false, error: 'token 驗證失敗', data: null })
  }
}

export function requireGovStaff(req: Request, res: Response, next: NextFunction) {
  if ((req as AuthedRequest).role !== 'gov_staff') {
    res.status(403).json({ success: false, error: '權限不足', data: null })
    return
  }
  next()
}
