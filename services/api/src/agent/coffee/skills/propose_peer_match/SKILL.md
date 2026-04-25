---
name: propose-peer-match
description: Create a peer-to-peer thread between two complementary users and notify them of the match. Use after confirming a meaningful pairing from persona data.
---

# propose_peer_match

Create a peer-to-peer thread between two users and notify them of the match.

## Usage
Call after evaluating that two users have complementary needs/offers and would benefit from connecting.

## Parameters
- `userAId` (required): UID of the first user.
- `userBId` (required): UID of the second user (must be different from userAId).
- `rationale` (required): Brief explanation of why these two users are a good match (1–2 sentences, internal).
- `initialMessage` (required): The introduction message to send to both users in Traditional Chinese. Introduce them to each other warmly and explain why they were matched.

## Returns
- `threadId`: ID of the created peer thread.
- `created`: false if a thread between these users already exists.

## Notes
- Only propose a match when you are confident the pairing is meaningful.
- The `initialMessage` is shown to both users — make it welcoming and explain the connection.
- Do not match the same pair more than once (the tool handles deduplication).
