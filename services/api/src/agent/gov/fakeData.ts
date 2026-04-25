import type { ChannelBroadcast, GovernmentResource } from '@matcha/shared-types'

export const fakeChannelBroadcasts: ChannelBroadcast[] = [
  {
    uid: 'user-xiaoya-001',
    displayName: '小雅',
    summary: '中文系大三，對品牌設計、排版和文組轉職有興趣，目前想找實習或職涯探索資源。',
    needs: ['職涯諮詢', '實習媒合', '職業培訓'],
    publishedAt: Date.now() - 60_000,
  },
  {
    uid: 'user-ming-002',
    displayName: '阿明',
    summary: '剛退伍，想找穩定工作，對餐飲、門市和政府職訓補助有興趣。',
    needs: ['就業輔導', '職業培訓'],
    publishedAt: Date.now() - 30_000,
  },
  {
    uid: 'user-lin-003',
    displayName: '小林',
    summary: '正在準備創業，想了解青年創業貸款、商業模式輔導和政府補助。',
    needs: ['創業輔導', '資金補助'],
    publishedAt: Date.now() - 10_000,
  },
]

export const fakeGovernmentResources: GovernmentResource[] = [
  {
    rid: 'rid-youth-career-001',
    agencyId: 'taipei-youth-dept',
    agencyName: '臺北市青年局',
    name: '青年職涯探索諮詢',
    description: '提供青年職涯方向探索、履歷健檢、面試準備與一對一職涯諮詢。',
    eligibilityCriteria: ['設籍或就學就業於臺北市', '年齡 18 至 35 歲青年', '對職涯方向或轉職有諮詢需求'],
    contactUrl: 'https://example.gov.taipei/youth-career',
    createdAt: Date.now(),
  },
  {
    rid: 'rid-design-intern-002',
    agencyId: 'taipei-youth-dept',
    agencyName: '臺北市青年局',
    name: '創意產業實習媒合計畫',
    description: '媒合對設計、品牌、內容企劃有興趣的青年進入創意產業實習。',
    eligibilityCriteria: ['大專院校學生或畢業三年內青年', '對設計、品牌、內容產業有興趣', '可投入至少兩個月實習'],
    contactUrl: 'https://example.gov.taipei/design-intern',
    createdAt: Date.now(),
  },
  {
    rid: 'rid-youth-startup-003',
    agencyId: 'taipei-youth-dept',
    agencyName: '臺北市青年局',
    name: '青年創業輔導與貸款說明',
    description: '提供青年創業前期諮詢、商業模式輔導、創業貸款說明與補助資訊。',
    eligibilityCriteria: ['年齡 20 至 45 歲', '有創業構想或已成立公司', '需要資金、商業模式或法規諮詢'],
    contactUrl: 'https://example.gov.taipei/startup',
    createdAt: Date.now(),
  },
]
