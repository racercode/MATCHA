---
name: write-channel-reply
description: Write a channel reply for an eligible government resource match
---

# write_channel_reply

Use this skill when Claude has decided that a channel message and the current government resource should produce a match reply.

## Input

```ts
interface WriteChannelReplyInput {
  assessment: MatchAssessment
}
```

## Output

```ts
interface WriteChannelReplyOutput {
  reply: ChannelReply
}
```

## Tool Call

Call the `write_channel_reply` custom tool.

Current implementation:

```txt
write_channel_reply custom tool -> backend -> writeChannelReplyToolWrapper -> create deterministic ChannelReply
```

Future implementation:

```txt
write_channel_reply custom tool -> backend -> writeChannelReplyToolWrapper -> Firestore channel_replies
```

## Notes

- Only use this when `decision.eligible === true`.
- Default threshold is `decision.score >= 70`.
- The created reply must point to the source `channelMessage.msgId`.
- Use `govId: resource.rid`.
- `content` should be a concise Traditional Chinese rationale that can be shown in Match Inbox and Gov Dashboard.
- Gov Agent does not create `human_threads`; those are created only after a government staff member opens a conversation.
