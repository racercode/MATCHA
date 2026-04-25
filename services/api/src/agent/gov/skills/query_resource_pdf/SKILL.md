---
name: query-resource-pdf
description: Query the PDF/resource document bound to this resource agent
---

# query_resource_pdf

Use this skill when Gov Agent needs its own government resource data before evaluating a match.

## Input

```ts
interface QueryResourcePdfInput {
  includeDetails?: boolean
}
```

## Output

```ts
interface QueryResourcePdfOutput {
  resources: GovernmentResource[]
}
```

## Tool Call

Call the `query_resource_pdf` custom tool.

Current implementation:

```txt
query_resource_pdf custom tool -> backend -> queryResourcePdfToolWrapper -> fakeData.ts
```

The backend decides which `GovernmentResource` is visible from the current agent/session context. Do not pass `agencyId` or `resourceId`; this skill returns only the resource bound to this resource agent.

Future implementation:

```txt
query_resource_pdf custom tool -> backend -> queryResourcePdfToolWrapper -> Firestore gov_resources/{rid}.pdfText
```

## Notes

- The resource scope is enforced by the backend, not by agent input.
- Treat the returned resource as the only government resource this agent can evaluate.
- Treat returned resource data as the source of truth.
