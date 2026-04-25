import Constants from 'expo-constants'

// Dynamically resolve the dev machine's IP via Expo's debugger host.
// Falls back to localhost for web / production.
const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost'
const MOCK_HOST = __DEV__ ? debuggerHost : 'localhost'

export const API_BASE_URL = `http://${MOCK_HOST}:3000`
export const WS_URL = `ws://${MOCK_HOST}:3000/ws`
