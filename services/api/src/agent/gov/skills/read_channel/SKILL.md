---
name: read_channel
description: Read recent persona broadcasts from the central channel
---

# read_channel

Use this skill when Gov Agent needs to read recent persona broadcasts from the central channel.

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
  broadcasts: ChannelBroadcast[]
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

- Use `since` to avoid re-processing old broadcasts.
- Use `limit` when running batch matching.
- Do not infer private user data beyond the broadcast payload.
