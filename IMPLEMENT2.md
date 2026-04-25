# Phase 2 Implementation

## Goal

Phase 2 adds a development API endpoint that simulates the Gov Agent being triggered after a channel update.

The endpoint is:

```txt
POST /gov/agent/run
```

This is not the final Firebase Realtime DB listener yet. It is a manual trigger that lets backend, Persona Agent, or API testing tools send a new `ChannelMessage` into the Gov Agent pipeline.

## What Was Implemented

Updated:

```txt
services/api/src/routes/gov.ts
services/api/src/routes/gov.test.ts
services/api/package.json
```

Added `POST /gov/agent/run` under the existing government router. The route is protected by the existing `verifyToken` and `requireGovStaff` middleware because `gov.ts` applies those middlewares to all `/gov/*` routes.

The route now:

1. Reads an optional `resourceId` from the request body.
2. Reads an optional single channel `message` from the request body.
3. Accepts the channel message shape from `channel_messages/{msgId}` and passes it directly into the Gov Agent pipeline.
4. Uses fake government resources from `fakeData.ts` for Phase 2 resource lookup.
5. Initializes or reuses the resource-scoped Claude Managed Agent session with `initGovManagedAgentSession()`.
6. Calls `runGovAgentPipeline()` with either the provided message or all `fakeChannelMessages`.
7. Returns `matches` JSON for API testing.

For testability, the Phase 2 request planning logic is extracted into pure helpers:

- `normalizeChannelMessage()`
- `selectResources()`
- `buildGovAgentRunPlan()`
- `serializeGovAgentResult()`

The HTTP route uses these helpers, while unit tests can verify the request behavior without calling Claude Managed Agent or Firebase.

## Request Body

Recommended single channel update payload:

```json
{
  "resourceId": "rid-design-intern-002",
  "message": {
    "msgId": "msg-001",
    "uid": "user-xiaoya-001",
    "summary": "中文系大三，對品牌設計、排版和文組轉職有興趣，目前想找實習或職涯探索資源。",
    "publishedAt": 1710000000000
  }
}
```

This matches the planned channel message shape:

```ts
interface ChannelMessage {
  msgId: string
  uid: string
  summary: string
  publishedAt: number
}
```

For temporary compatibility with earlier Phase 2 wording, the route still accepts `broadcast` as an alias for `message`, but Persona Agent should send `message`.

```json
{
  "resourceId": "rid-design-intern-002",
  "broadcast": {
    "msgId": "msg-001",
    "uid": "user-xiaoya-001",
    "summary": "中文系大三，對品牌設計、排版和文組轉職有興趣，目前想找實習或職涯探索資源。",
    "publishedAt": 1710000000000
  }
}
```

Optional fields:

- `agencyId`: fallback agency id when the authenticated gov staff request has no `agencyId`; default is `taipei-youth-dept`.
- `threshold`: match score threshold from 0 to 100; default is `70`.

If `message` is omitted, the route runs all `fakeChannelMessages`. If `resourceId` is omitted, it runs all fake resources for the agency. This is useful for smoke testing the whole fake Phase 1 pipeline through an API.

## Response Shape

Successful response:

```json
{
  "success": true,
  "data": {
    "trigger": "channel_message",
    "agencyId": "taipei-youth-dept",
    "resourceIds": ["rid-design-intern-002"],
    "threshold": 70,
    "matches": []
  }
}
```

Each match includes:

- `thread`
- `initialMessage`
- `reason`
- `missingInfo`
- `assessment`

## Validation and Errors

The route returns `400` when:

- `message` or `broadcast` is present but missing `msgId`, `uid`, or `summary`.
- `threshold` is not an integer from 0 to 100.

The route returns `404` when:

- `resourceId` does not exist in fake resources for the selected agency.
- No fake resources exist for the selected agency.

The route returns `500` when:

- Claude Managed Agent session initialization fails.
- The Gov Agent pipeline fails.

## Current Limits

This is still Phase 2 only:

- It does not listen to Firebase Realtime DB automatically.
- It does not write `AgentThread` or `ThreadMessage` to Firestore.
- It does not send WebSocket or FCM notifications.
- It uses fake resources and fake channel messages when request data is omitted.

The future Realtime DB listener can call the same pipeline internally, most likely through `runGovAgentForChannelUpdate()` or `runGovAgentPipeline()`, without needing to call this HTTP endpoint.

## Verification Notes

Commands run:

```txt
corepack pnpm --filter api gov:test
corepack pnpm --filter api build
```

Result:

- `gov:test` passed.
- `api` build passed.

The new route tests cover:

- `summary` channel message payloads.
- `broadcast` alias compatibility.
- invalid message validation.
- selecting one resource by `resourceId`.
- fallback to all fake channel messages and all fake agency resources.
- authenticated agency overriding request body agency.
- invalid threshold validation.
- unknown `resourceId` returning a 404 plan.
- serialized match response shape.
