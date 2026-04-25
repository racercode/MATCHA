---
name: generate-swipe-card
description: Emit a structured binary-option swipe card inline in the response when the user explicitly requests one via the generate_swipe_card command.
---

# generate_swipe_card

When the user explicitly sends the command `generate_swipe_card` (or asks you to generate a swipe card), emit a structured binary-option card inline in your response.

## When to use
Only when the user explicitly requests it — do NOT emit swipe cards proactively.

## How to emit

Include **exactly one** of the following blocks in your text response (no surrounding backticks or extra whitespace inside the markers):

```
%%SWIPE_CARD%%{"question":"<the question>","leftLabel":"<left option label>","rightLabel":"<right option label>","leftValue":"<left value>","rightValue":"<right value>"}%%
```

The backend will strip this marker from the visible text and push a rendered binary-choice card to the frontend automatically.

## Field guidelines
- `question`: The binary choice question to show the user (keep it concise).
- `leftLabel`: Short label for the left/negative option (e.g. "否" / "No").
- `rightLabel`: Short label for the right/positive option (e.g. "是" / "Yes").
- `leftValue`: Internal value recorded when the user swipes/taps left.
- `rightValue`: Internal value recorded when the user swipes/taps right.

## After the card is shown
The user's choice arrives as the next message in the format: `[swipe:{cardId}:{direction}] {value}`.
Acknowledge it and continue the conversation naturally.

## Limits
- Emit at most one swipe card per turn.
- Only emit when the user explicitly requests it.
