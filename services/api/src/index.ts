import 'dotenv/config'
import http from 'http'
import { createApp } from './app.js'
import { createWss, upgradeHandler } from './ws/handler.js'

const PORT = Number(process.env.PORT ?? 3001)
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

const enableMock = process.argv.includes('--mock') || process.env.ENABLE_MOCK === 'true'
if (enableMock) {
  const { startMockServer } = await import('./mock/server.js')
  await startMockServer(3002)
}
