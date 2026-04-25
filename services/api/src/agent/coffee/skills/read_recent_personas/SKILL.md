---
name: read-recent-personas
description: Read the most recently updated user personas to discover potential peer matches. Use before proposing a peer match.
---

# read_recent_personas

Read the most recently updated user personas from the system.

## Usage
Call this to discover potential peer matches. Returns users sorted by most recently updated.

## Parameters
- `limit` (optional): Maximum number of personas to return (default: 20).

## Returns
Array of PersonaSummary objects with:
- `uid`: user identifier
- `displayName`: user's display name
- `summary`: natural language description
- `needs`: list of things the user needs
- `offers`: list of things the user can contribute
- `updatedAt`: last update timestamp (unix ms)

## Notes
- Use the `needs` and `offers` arrays to evaluate complementarity between users.
- A good match has user A's offers overlapping with user B's needs, or shared goals.
