---
name: relay-message
description: Send a Coffee Agent message into an existing peer thread. Use sparingly to inject icebreakers or facilitation prompts when users seem stuck.
---

# relay_message

Send a message from the Coffee Agent into an existing peer thread.

## Usage
Use to inject an icebreaker, tip, or facilitation message into an ongoing peer conversation.

## Parameters
- `threadId` (required): The peer thread ID to post into.
- `content` (required): The message content in Traditional Chinese.

## Returns
- `relayed`: true if the message was sent.
- `mid`: message ID of the sent message.

## Notes
- The message will appear from "coffee_agent" — users know it's from the system.
- Use sparingly: only when users seem stuck or need a conversation prompt.
