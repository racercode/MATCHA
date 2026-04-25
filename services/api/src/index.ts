import 'dotenv/config'
import http from 'http'
import { initializeApp, cert } from 'firebase-admin/app'
import { createApp } from './app.js'
import { createWss, upgradeHandler } from './ws/handler.js'

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
  databaseURL: process.env.FIREBASE_REALTIME_DB_URL,
})

// ---------------------------------------------------------------------------
// Real API server (Express + WebSocket)
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT ?? 3000)
const app = createApp()
const server = http.createServer(app)
const wss = createWss()

server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url ?? '', 'http://localhost').pathname === '/ws') {
    upgradeHandler(wss, req, socket as import('net').Socket, head)
  } else {
    socket.destroy()
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[api] server running on http://localhost:${PORT}`)
  console.log(`[api] WebSocket on ws://localhost:${PORT}/ws`)
})

// ---------------------------------------------------------------------------
// Optional mock server (port 3001)
// Pass --mock flag or set ENABLE_MOCK=true
// ---------------------------------------------------------------------------

const enableMock = process.argv.includes('--mock') || process.env.ENABLE_MOCK === 'true'

if (enableMock) {
  const { startMockServer } = await import('./mock/server.js')
  await startMockServer(3001)
}
