import { Router, type Router as IRouter } from 'express'
import { govStaff } from '../lib/store.js'

const router: IRouter = Router()

// POST /auth/verify
// Accepts { idToken } where idToken is just the uid string (no Firebase)
router.post('/auth/verify', (req, res) => {
  const { idToken } = req.body
  if (!idToken || typeof idToken !== 'string') {
    res.status(400).json({ success: false, error: '缺少 idToken', data: null })
    return
  }

  const uid = idToken.trim()
  const staff = govStaff.get(uid)

  if (staff) {
    res.json({ success: true, data: { uid, role: 'gov_staff', govId: staff.govId } })
  } else {
    res.json({ success: true, data: { uid, role: 'citizen' } })
  }
})

export default router
