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

Call the `readChannelToolWrapper` tool wrapper.

Current implementation:

```txt
readChannelToolWrapper -> fakeData.ts
```

Future implementation:

```txt
readChannelToolWrapper -> Firebase Realtime DB or MCP tool
```

## Notes

- Use `since` to avoid re-processing old broadcasts.
- Use `limit` when running batch matching.
- Do not infer private user data beyond the broadcast payload.
