import type { GovernmentResource } from '@matcha/shared-types'
import { fakeGovernmentResources } from '../fakeData.js'

export interface QueryProgramDocsInput {
  agencyId: string
  resourceId?: string
}

export interface QueryProgramDocsOutput {
  resources: GovernmentResource[]
}

export function queryProgramDocsToolWrapper(input: QueryProgramDocsInput): QueryProgramDocsOutput {
  let resources = fakeGovernmentResources.filter(r => r.agencyId === input.agencyId)

  if (input.resourceId) {
    resources = resources.filter(r => r.rid === input.resourceId)
  }

  return { resources }
}
