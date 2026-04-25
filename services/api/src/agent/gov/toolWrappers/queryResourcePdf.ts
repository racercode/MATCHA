import type { GovernmentResource } from '@matcha/shared-types'

export interface QueryResourcePdfInput {
  includeDetails?: boolean
}

export interface GovToolRuntimeContext {
  agencyId: string
  resourceId: string
  resource?: GovernmentResource
}

export interface QueryResourcePdfOutput {
  resources: GovernmentResource[]
}

export function queryResourcePdfToolWrapper(
  _input: QueryResourcePdfInput | undefined,
  context: GovToolRuntimeContext,
): QueryResourcePdfOutput {
  if (context.resource) {
    return { resources: [context.resource] }
  }
  return { resources: [] }
}
