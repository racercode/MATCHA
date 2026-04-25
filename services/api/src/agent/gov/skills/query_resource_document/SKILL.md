---
name: query-resource-document
description: Query the resource documents bound to this resource agent
---

# query_resource_document

Use this skill when Gov Agent needs its own government resource data and document text before evaluating a match.

## Input

```ts
interface QueryResourcePdfInput {
  includeDetails?: boolean
}
```

## Output

```ts
interface QueryResourcePdfOutput {
  resource: GovernmentResource | null
  resources: GovernmentResource[]
  documents: GovernmentResourceDocument[]
}
```

## Tool Call

Call the `query_resource_document` custom tool.

Current implementation:

```txt
query_resource_document custom tool
-> backend
-> queryResourcePdfToolWrapper
-> Firestore gov_resources/{rid}
-> Firestore gov_resources/{rid}/documents/*
```

The backend decides which `GovernmentResource` and documents are visible from the current agent/session context. Do not pass `agencyId` or `resourceId`; this skill returns only the resource and documents bound to this resource agent.

No-Firebase fallback:

```txt
query_resource_document custom tool -> backend -> queryResourcePdfToolWrapper -> fakeData.ts summary document
```

## Notes

- The resource scope is enforced by the backend, not by agent input.
- Treat the returned resource and documents as the only government resource context this agent can evaluate.
- Treat returned document `extractedText` as the source of truth for detailed eligibility, application notes, and program details.
- Documents may come from PDF, Markdown, txt, html, CSV, XLSX, URL, or other sources.
