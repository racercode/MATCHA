import type { Request, Response, NextFunction } from 'express'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

export interface AuthedRequest extends Request {
  uid: string
  role: 'citizen' | 'gov_staff'
  agencyId?: string
}

export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '未提供 token', data: null })
    return
  }

  const idToken = header.slice(7)
  try {
    const decoded = await getAuth().verifyIdToken(idToken)
    const uid = decoded.uid

    const db = getFirestore()
    const govDoc = await db.doc(`gov_staff/${uid}`).get()

    const authed = req as AuthedRequest
    authed.uid = uid
    if (govDoc.exists) {
      authed.role = 'gov_staff'
      authed.agencyId = govDoc.data()?.agencyId as string | undefined
    } else {
      authed.role = 'citizen'
    }

    next()
  } catch {
    res.status(401).json({ success: false, error: 'token 無效或已過期', data: null })
  }
}

export function requireGovStaff(req: Request, res: Response, next: NextFunction) {
  const authed = req as AuthedRequest
  if (authed.role !== 'gov_staff') {
    res.status(403).json({ success: false, error: '權限不足', data: null })
    return
  }
  next()
}
