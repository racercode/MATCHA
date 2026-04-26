import Constants from 'expo-constants'

// Dynamically resolve the dev machine's IP via Expo's debugger host.
// Falls back to localhost for web / production.
const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost'
const MOCK_HOST = __DEV__ ? debuggerHost : 'localhost'

export const API_BASE_URL = `http://${MOCK_HOST}:3000`
export const WS_URL = `ws://${MOCK_HOST}:3000/ws`

export async function postResourceFollowUp(
  token: string,
  params: { resourceId: string; replyId: string; question: string },
): Promise<{ answer: string; resourceId: string; replyId: string }> {
  const res = await fetch(`${API_BASE_URL}/api/resource-followup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Follow-up failed')
  return json.data
}
