---
name: read_channel
description: Read recent channel messages from the central channel
---

# read_channel

Use this skill when Gov Agent needs to read recent channel messages from the central channel.

## Input

```ts
interface ReadChannelInput {
  since?: number
  limit?: number
}
```

## Output

```ts
interface ReadChannelOutput {
  messages: ChannelMessage[]
}
```

## Tool Call

Call the `read_channel` custom tool.

Current implementation:

```txt
read_channel custom tool -> backend -> readChannelToolWrapper -> fakeData.ts
```

Future implementation:

```txt
read_channel custom tool -> backend -> readChannelToolWrapper -> Firebase Realtime DB
```

## Notes

- Use `since` to avoid re-processing old messages.
- Use `limit` when running batch matching.
- Do not infer private user data beyond the channel message payload.
