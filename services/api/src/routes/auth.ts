import { Router, type Router as IRouter } from 'express'
import { auth, db } from '../lib/firebase.js'

const router: IRouter = Router()

router.post('/auth/verify', async (req, res) => {
  const { idToken } = req.body
  if (!idToken || typeof idToken !== 'string') {
    res.status(400).json({ success: false, error: '缺少 idToken', data: null })
    return
  }

  try {
    const decoded = await auth.verifyIdToken(idToken)
    const uid = decoded.uid
    const staffDoc = await db.collection('gov_staff').doc(uid).get()
    if (staffDoc.exists) {
      res.json({ success: true, data: { uid, role: 'gov_staff', govId: staffDoc.data()!.govId } })
    } else {
      res.json({ success: true, data: { uid, role: 'citizen' } })
    }
  } catch {
    res.status(401).json({ success: false, error: 'token 驗證失敗', data: null })
  }
})

export default router
