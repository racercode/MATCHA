---
name: update-persona
description: Persist an updated persona for the active user. Use after gathering enough information from conversation to describe the user's situation, needs, and offers.
---

# update_persona

Persist an updated persona for the active user.

## Usage
Call immediately whenever the user shares ANY new information about themselves — their goals, challenges, interests, background, or what they need. Do NOT wait to collect "enough" information. Update with whatever is known so far, even if needs or offers are still incomplete.

## Parameters
- `summary` (required): A 1–3 sentence natural language description of who the user is and their current situation.
- `needs` (required): Array of strings representing what the user needs (e.g., "就業輔導", "創業資金"). Use empty array `[]` if none known yet.
- `offers` (required): Array of strings representing what the user can contribute or share (e.g., "軟體開發經驗", "社區志工"). Use empty array `[]` if none known yet.

## Notes
- Call this after EVERY message that reveals something about the user. Be aggressive — partial info is better than no info.
- Keep `summary` concise but informative — it's used for matching.
- `needs` and `offers` should be short phrases, not sentences.
- After calling this, if `needs` is non-empty, also call `publish_to_channel` in the same turn.
