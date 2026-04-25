import type { GovernmentResource } from '@matcha/shared-types'
import { fakeGovernmentResources } from '../fakeData.js'

export interface QueryProgramDocsInput {
  includeDetails?: boolean
}

export interface GovToolRuntimeContext {
  agencyId: string
  resourceId: string
}

export interface QueryProgramDocsOutput {
  resources: GovernmentResource[]
}

export function queryProgramDocsToolWrapper(
  _input: QueryProgramDocsInput | undefined,
  context: GovToolRuntimeContext,
): QueryProgramDocsOutput {
  const resources = fakeGovernmentResources.filter(
    r => r.agencyId === context.agencyId && r.rid === context.resourceId,
  )

  return { resources }
}
