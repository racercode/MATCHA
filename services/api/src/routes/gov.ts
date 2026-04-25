import { Router } from 'express'
import { verifyToken, requireGovStaff, type AuthedRequest } from '../middleware/auth.js'

const router = Router()
router.use(verifyToken, requireGovStaff)

router.get('/gov/resources', async (req, res) => {
  const { agencyId } = req as AuthedRequest
  // TODO: query Firestore /resources where agencyId matches
  res.json({ success: true, data: { items: [], total: 0, hasMore: false } })
})

router.post('/gov/resources', async (req, res) => {
  const { uid, agencyId } = req as AuthedRequest
  const { name, description, eligibilityCriteria, tags, contactUrl } = req.body
  if (!name || !description || !eligibilityCriteria) {
    res.status(400).json({ success: false, error: '缺少必要欄位', data: null })
    return
  }
  // TODO: write to Firestore, initialize Gov Agent with this resource
  const resource = {
    rid: `rid-${Date.now()}`,
    agencyId,
    agencyName: '', // TODO: fetch from agency profile
    name, description, eligibilityCriteria,
    tags: tags ?? [],
    contactUrl,
    createdAt: Date.now(),
  }
  res.status(201).json({ success: true, data: resource })
})

router.get('/gov/threads', async (req, res) => {
  const { agencyId } = req as AuthedRequest
  const { type, status, limit = '20', offset = '0' } = req.query
  // TODO: query Firestore threads where initiatorId starts with gov:{rid} for this agency
  res.json({ success: true, data: { items: [], total: 0, hasMore: false } })
})

router.get('/gov/dashboard', async (req, res) => {
  const { agencyId } = req as AuthedRequest
  const { since } = req.query
  // TODO: aggregate stats from Firestore
  res.json({
    success: true,
    data: {
      totalMatches: 0,
      humanTakeoverCount: 0,
      activeThreads: 0,
      matchedToday: 0,
      tagDistribution: {},
      needsDistribution: {},
    },
  })
})

export default router
