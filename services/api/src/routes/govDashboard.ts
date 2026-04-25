import { Router, type Router as IRouter } from 'express'
import { verifyToken, requireGovStaff } from '../middleware/auth.js'
import { getAllMatchStats, getMatchStats } from '../lib/matchStatsRepo.js'
import { listGovernmentResources } from '../lib/govResourcesRepo.js'

const router: IRouter = Router()

router.use('/gov/dashboard', verifyToken, requireGovStaff)

// GET /gov/dashboard/agents — number of active resource agents
router.get('/gov/dashboard/agents', async (_req, res) => {
  try {
    const resources = await listGovernmentResources()
    res.json({
      success: true,
      data: {
        agentCount: resources.length,
        agents: resources.map(r => ({ rid: r.rid, name: r.name })),
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '讀取資源失敗',
      data: null,
    })
  }
})

// GET /gov/dashboard/stats — aggregate match stats across all resources
router.get('/gov/dashboard/stats', async (_req, res) => {
  try {
    const allStats = await getAllMatchStats()
    const totalAttempts = allStats.reduce((sum, s) => sum + s.totalAttempts, 0)
    const totalMatches = allStats.reduce((sum, s) => sum + s.totalMatches, 0)
    const matchRate = totalAttempts > 0 ? Math.round((totalMatches / totalAttempts) * 10000) / 100 : 0

    res.json({
      success: true,
      data: {
        totalAttempts,
        totalMatches,
        matchRate,
        resources: allStats.map(s => ({
          resourceId: s.resourceId,
          resourceName: s.resourceName,
          totalAttempts: s.totalAttempts,
          totalMatches: s.totalMatches,
          matchRate: s.totalAttempts > 0
            ? Math.round((s.totalMatches / s.totalAttempts) * 10000) / 100
            : 0,
        })),
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '讀取統計失敗',
      data: null,
    })
  }
})

// GET /gov/dashboard/stats/:resourceId — single resource match stats
router.get('/gov/dashboard/stats/:resourceId', async (req, res) => {
  try {
    const stats = await getMatchStats(req.params.resourceId)
    if (!stats) {
      res.json({
        success: true,
        data: {
          resourceId: req.params.resourceId,
          totalAttempts: 0,
          totalMatches: 0,
          matchRate: 0,
        },
      })
      return
    }

    const matchRate = stats.totalAttempts > 0
      ? Math.round((stats.totalMatches / stats.totalAttempts) * 10000) / 100
      : 0

    res.json({
      success: true,
      data: {
        resourceId: stats.resourceId,
        resourceName: stats.resourceName,
        agencyId: stats.agencyId,
        totalAttempts: stats.totalAttempts,
        totalMatches: stats.totalMatches,
        matchRate,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '讀取統計失敗',
      data: null,
    })
  }
})

export default router
