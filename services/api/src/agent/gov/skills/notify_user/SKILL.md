# notify_user

Use this skill after a `gov_user` match thread is created and the citizen app should be notified.

## Input

```ts
interface NotifyUserInput {
  uid: string
  thread: AgentThread
  resource: GovernmentResource
}
```

## Output

```ts
interface NotifyUserOutput {
  delivered: boolean
  channel: 'websocket' | 'fcm' | 'mock'
}
```

## Tool Call

Call the future `notifyUserToolWrapper` tool wrapper.

Current implementation:

```txt
not implemented in Phase 1
```

Future implementation:

```txt
notifyUserToolWrapper -> WebSocket match_notify, then FCM fallback
```

## Notes

- Prefer WebSocket for demo speed.
- Use FCM only as fallback when the user is offline.
- Do not send duplicate notifications for the same `thread.tid`.
