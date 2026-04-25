import type { GovernmentResource, GovernmentResourceDocument } from '@matcha/shared-types'
import { fakeGovernmentResources } from '../fakeData.js'
import { hasFirebaseAdminEnv } from '../../../lib/firebaseEnv.js'

export interface QueryResourcePdfInput {
  includeDetails?: boolean
}

export interface GovToolRuntimeContext {
  agencyId: string
  resourceId: string
  resource?: GovernmentResource
}

export interface QueryResourcePdfOutput {
  resource: GovernmentResource | null
  resources: GovernmentResource[]
  documents: GovernmentResourceDocument[]
}

function buildFallbackDocument(resource: GovernmentResource): GovernmentResourceDocument {
  const extractedText = [
    `資源名稱：${resource.name}`,
    `資源描述：${resource.description}`,
    `資格條件：${resource.eligibilityCriteria.join('、')}`,
    resource.contactUrl ? `聯絡網址：${resource.contactUrl}` : '',
  ].filter(Boolean).join('\n')

  return {
    docId: `${resource.rid}-summary`,
    rid: resource.rid,
    filename: `${resource.rid}.summary.txt`,
    kind: 'txt',
    extractedText,
    textLength: extractedText.length,
    createdAt: resource.createdAt,
  }
}

function queryFakeResourceContext(context: GovToolRuntimeContext): QueryResourcePdfOutput {
  const resources = context.resource
    ? [context.resource]
    : fakeGovernmentResources.filter(
      r => r.agencyId === context.agencyId && r.rid === context.resourceId,
    )
  const resource = resources[0] ?? null
  const documents = resource ? [buildFallbackDocument(resource)] : []

  return { resource, resources, documents }
}

export async function queryResourcePdfToolWrapper(
  _input: QueryResourcePdfInput | undefined,
  context: GovToolRuntimeContext,
): Promise<QueryResourcePdfOutput> {
  if (hasFirebaseAdminEnv()) {
    const { getGovernmentResource, listGovernmentResourceDocuments } = await import('../../../lib/govResourcesRepo.js')
    const resource = await getGovernmentResource(context.resourceId)

    if (!resource || resource.agencyId !== context.agencyId) {
      return queryFakeResourceContext(context)
    }

    const documents = await listGovernmentResourceDocuments(resource.rid)
    return { resource, resources: [resource], documents }
  }

  return queryFakeResourceContext(context)
}
