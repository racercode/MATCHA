---
name: query_program_docs
description: Query the resource document bound to this resource agent
---

# query_program_docs

Use this skill when Gov Agent needs its own government resource data before evaluating a match.

## Input

```ts
interface QueryProgramDocsInput {
  includeDetails?: boolean
}
```

## Output

```ts
interface QueryProgramDocsOutput {
  resources: GovernmentResource[]
}
```

## Tool Call

Call the `query_program_docs` custom tool.

Current implementation:

```txt
query_program_docs custom tool -> backend -> queryProgramDocsToolWrapper -> fakeData.ts
```

The backend decides which `GovernmentResource` is visible from the current agent/session context. Do not pass `agencyId` or `resourceId`; this skill returns only the resource bound to this resource agent.

Future implementation:

```txt
query_program_docs custom tool -> backend -> queryProgramDocsToolWrapper -> Firestore or RAG, scoped by session/resource registry
```

## Notes

- The resource scope is enforced by the backend, not by agent input.
- Treat the returned resource as the only government resource this agent can evaluate.
- Treat returned resource data as the source of truth.
