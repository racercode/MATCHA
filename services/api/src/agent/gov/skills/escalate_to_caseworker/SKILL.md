# escalate_to_caseworker

Use this skill when the match requires human judgment from a government caseworker.

## Input

```ts
interface EscalateToCaseworkerInput {
  threadId: string
  reason: string
  summary: string
}
```

## Output

```ts
interface EscalateToCaseworkerOutput {
  escalated: boolean
  govPresence: 'human' | 'both'
}
```

## Tool Call

Call the future `escalate_to_caseworker` custom tool.

Current implementation:

```txt
not implemented in Phase 1
```

Future implementation:

```txt
escalate_to_caseworker custom tool -> backend -> escalateToCaseworkerToolWrapper -> Firestore thread update + gov dashboard notification
```

## Notes

- Use this when required eligibility information is missing.
- Use this when the user asks a policy-specific question that must not be guessed.
- Include a concise summary for the caseworker.
