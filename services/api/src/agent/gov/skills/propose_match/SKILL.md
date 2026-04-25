# propose_match

Use this skill when Claude has decided that a persona broadcast and government resource should become a `gov_user` match.

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

Call the `proposeMatchToolWrapper` tool wrapper.

Current implementation:

```txt
proposeMatchToolWrapper -> create deterministic draft AgentThread + initial ThreadMessage
```

Future implementation:

```txt
proposeMatchToolWrapper -> Firestore threads + thread_messages, or MCP tool
```

## Notes

- Only use this when `decision.eligible === true`.
- Default threshold is `decision.score >= 70`.
- The created thread must use `type: 'gov_user'`.
- Use `initiatorId: gov:{resourceId}` and `responderId: user:{uid}`.
- The initial message must use `from: gov_agent:{resourceId}` and `type: 'decision'`.
- Gov Agent does not notify the citizen directly; User Agent should read the initial `ThreadMessage` and decide how to notify the user.
