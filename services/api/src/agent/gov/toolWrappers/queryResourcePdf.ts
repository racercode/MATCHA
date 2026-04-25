import type { GovernmentResource } from '@matcha/shared-types'
import { fakeGovernmentResources } from '../fakeData.js'

export interface QueryResourcePdfInput {
  includeDetails?: boolean
}

export interface GovToolRuntimeContext {
  agencyId: string
  resourceId: string
}

export interface QueryResourcePdfOutput {
  resources: GovernmentResource[]
}

export function queryResourcePdfToolWrapper(
  _input: QueryResourcePdfInput | undefined,
  context: GovToolRuntimeContext,
): QueryResourcePdfOutput {
  const resources = fakeGovernmentResources.filter(
    r => r.agencyId === context.agencyId && r.rid === context.resourceId,
  )

  return { resources }
}
