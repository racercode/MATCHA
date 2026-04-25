---
name: get-my-persona
description: Retrieve the current persona for the active user. Use at the start of a conversation or when recalling what is already known about the user.
---

# get_my_persona

Retrieve the current persona for the active user.

## Usage
Call this at the start of a conversation or when you need to recall what you already know about the user.

## Returns
A UserPersona object with:
- `uid`: user identifier
- `displayName`: user's display name
- `summary`: natural language description of the user
- `needs`: list of things the user is looking for
- `offers`: list of skills/resources the user can contribute
- `updatedAt`: last update timestamp

## Notes
- Returns an empty persona if no data has been collected yet.
- Always call this before deciding what questions to ask.
