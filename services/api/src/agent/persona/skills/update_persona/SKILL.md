---
name: update-persona
description: Persist an updated persona for the active user. Use after gathering enough information from conversation to describe the user's situation, needs, and offers.
---

# update_persona

Persist an updated persona for the active user.

## Usage
Call after gathering enough information from conversation to meaningfully describe the user's situation, needs, and offers.

## Parameters
- `summary` (required): A 1–3 sentence natural language description of who the user is and their current situation.
- `needs` (required): Array of strings representing what the user needs (e.g., "就業輔導", "創業資金").
- `offers` (required): Array of strings representing what the user can contribute or share (e.g., "軟體開發經驗", "社區志工").

## Notes
- Update incrementally as you learn more. Don't wait until you know everything.
- Keep `summary` concise but informative — it's used for matching.
- `needs` and `offers` should be short phrases, not sentences.
