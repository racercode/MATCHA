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

Call the `queryProgramDocsToolWrapper` tool wrapper.

Current implementation:

```txt
queryProgramDocsToolWrapper -> fakeData.ts
```

Future implementation:

```txt
queryProgramDocsToolWrapper -> Firestore, RAG, or MCP tool
```

## Notes

- Use `agencyId` to scope resources to the current government agency.
- Use `resourceId` when evaluating one specific resource.
- Treat returned resource data as the source of truth.
