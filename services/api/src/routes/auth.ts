import { Router, type Router as IRouter } from 'express'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const router: IRouter = Router()

router.post('/auth/verify', async (req, res) => {
  const { idToken } = req.body
  if (!idToken) {
    res.status(400).json({ success: false, error: '缺少 idToken', data: null })
    return
  }

  try {
    const decoded = await getAuth().verifyIdToken(idToken)
    const uid = decoded.uid

    const db = getFirestore()
    const govDoc = await db.doc(`gov_staff/${uid}`).get()

    if (govDoc.exists) {
      res.json({
        success: true,
        data: { uid, role: 'gov_staff', agencyId: govDoc.data()?.agencyId },
      })
    } else {
      res.json({ success: true, data: { uid, role: 'citizen' } })
    }
  } catch {
    res.status(401).json({ success: false, error: 'token 無效或已過期', data: null })
  }
})

export default router
