import assert from 'node:assert/strict'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { apply, normalizeSettings } from '../index.js'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nVQAAAAASUVORK5CYII=',
  'base64',
)

async function json(url, init) {
  const response = await fetch(url, init)
  const payload = await response.json()
  return { response, payload }
}

test('normalizeSettings clamps and rejects invalid values', () => {
  const normalized = normalizeSettings({
    enabled: true,
    fit: 'diagonal',
    opacity: 9,
    blur: -2,
    dim: 2,
    surface: 0.01,
    image: { file: '../escape.png' },
  })
  assert.equal(normalized.image, null)
  assert.equal(normalized.enabled, false)
  assert.equal(normalized.fit, 'cover')
  assert.equal(normalized.opacity, 1)
  assert.equal(normalized.blur, 0)
  assert.equal(normalized.dim, 0.8)
  assert.equal(normalized.surface, 0.15)
})

test('host routes upload, serve, update and remove an image', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-background-test-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const routes = new Map()
  let server
  try {
    apply({
      logger: { info() {}, warn() {}, error() {} },
      inject(names, callback) {
        assert.deepEqual(names, ['webServer'])
        callback({
          webServer: {
            register({ path: route, handler }) {
              routes.set(route, handler)
              return () => routes.delete(route)
            },
          },
          effect(callback) {
            return callback()
          },
        })
      },
    })

    server = http.createServer((req, res) => {
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname
      const handler = routes.get(pathname)
      if (!handler) {
        res.writeHead(404)
        res.end()
        return
      }
      handler(req, res)
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}`

    const empty = await json(`${base}/dsh-background-studio/api/state`)
    assert.equal(empty.response.status, 200)
    assert.equal(empty.payload.image, null)
    assert.equal(empty.payload.settings.enabled, false)

    const uploaded = await json(`${base}/dsh-background-studio/api/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'X-DSH-Background-Name': encodeURIComponent('测试 图片.png'),
      },
      body: PNG,
    })
    assert.equal(uploaded.response.status, 200)
    assert.equal(uploaded.payload.image.name, '测试 图片.png')
    assert.equal(uploaded.payload.image.contentType, 'image/png')
    assert.equal(uploaded.payload.settings.enabled, true)

    const image = await fetch(`${base}${uploaded.payload.image.url}`)
    assert.equal(image.status, 200)
    assert.equal(image.headers.get('content-type'), 'image/png')
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), PNG)

    const changed = await json(`${base}/dsh-background-studio/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fit: 'tile', opacity: 0.4, blur: 100, dim: -1, surface: 0.5 }),
    })
    assert.equal(changed.response.status, 200)
    assert.equal(changed.payload.settings.fit, 'tile')
    assert.equal(changed.payload.settings.opacity, 0.4)
    assert.equal(changed.payload.settings.blur, 24)
    assert.equal(changed.payload.settings.dim, 0)
    assert.equal(changed.payload.settings.surface, 0.5)

    const removed = await json(`${base}/dsh-background-studio/api/image`, { method: 'DELETE' })
    assert.equal(removed.response.status, 200)
    assert.equal(removed.payload.image, null)
    assert.equal(removed.payload.settings.enabled, false)
    assert.equal((await fetch(`${base}/dsh-background-studio/image`)).status, 404)

    const rejected = await fetch(`${base}/dsh-background-studio/api/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/svg+xml' },
      body: Buffer.from('<svg/>'),
    })
    assert.equal(rejected.status, 415)
  } finally {
    if (server) {
      server.close()
      await once(server, 'close')
    }
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    await fs.rm(home, { recursive: true, force: true })
  }
})
