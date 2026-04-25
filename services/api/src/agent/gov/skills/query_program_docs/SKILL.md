---
name: query_program_docs
description: Query government resource documents for an agency
---

# query_program_docs

Use this skill when Gov Agent needs government resource data before evaluating a match.

## Input

```ts
interface QueryProgramDocsInput {
  agencyId: string
  resourceId?: string
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

Future implementation:

```txt
query_program_docs custom tool -> backend -> queryProgramDocsToolWrapper -> Firestore or RAG
```

## Notes

- Use `agencyId` to scope resources to the current government agency.
- Use `resourceId` when evaluating one specific resource.
- Treat returned resource data as the source of truth.
