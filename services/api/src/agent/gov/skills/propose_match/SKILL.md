---
name: propose_match
description: Create a draft match thread and initial message for an eligible match
---

# propose_match

Use this skill when Claude has decided that a channel message and government resource should become a `gov_user` match.

## Input

```ts
interface ProposeMatchInput {
  assessment: MatchAssessment
}
```

## Output

```ts
interface ProposeMatchOutput {
  thread: AgentThread
  initialMessage: ThreadMessage
}
```

## Tool Call

Call the `propose_match` custom tool.

Current implementation:

```txt
propose_match custom tool -> backend -> proposeMatchToolWrapper -> create deterministic draft AgentThread + initial ThreadMessage
```

Future implementation:

```txt
propose_match custom tool -> backend -> proposeMatchToolWrapper -> Firestore threads + thread_messages
```

## Notes

- Only use this when `decision.eligible === true`.
- Default threshold is `decision.score >= 70`.
- The created thread must use `type: 'gov_user'`.
- Use `initiatorId: gov:{resourceId}` and `responderId: user:{uid}`.
- The initial message must use `from: gov_agent:{resourceId}` and `type: 'decision'`.
- Gov Agent does not notify the citizen directly; User Agent should read the initial `ThreadMessage` and decide how to notify the user.
