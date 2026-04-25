---
name: publish-to-channel
description: Publish the user's persona summary to the central matching channel. Use when the user's needs are clear enough to trigger matching with government resources and peers.
---

# publish_to_channel

Publish the user's persona summary to the central matching channel.

## Usage
Call when the user's needs are clear enough to attract relevant government resources and peer connections. This triggers the matching system.

## Parameters
- `summary` (required): A public-facing summary of the user's situation and goals. Keep it under 150 characters.
- `needs` (required): Array of the user's top needs (1–4 items).

## Notes
- Only publish once per session unless the user's needs change significantly.
- The summary will be visible to government resource agents and the coffee matching agent.
- Always call `update_persona` first to ensure the full persona is saved before publishing.
- Inform the user that their summary has been published.
