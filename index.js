/**
 * dsh-background-studio — Host half.
 *
 * Keeps the imported image and the display settings on disk, and exposes a
 * tiny same-origin HTTP surface for the browser half:
 *
 *   GET    /dsh-background-studio/api/state      current settings + image metadata
 *   POST   /dsh-background-studio/api/settings   update display settings
 *   POST   /dsh-background-studio/api/image      upload/replace the image
 *   DELETE /dsh-background-studio/api/image      remove the image
 *   GET    /dsh-background-studio/image          the image bytes
 *
 * Data lives in `$DSH_HOME/dsh-background/`, outside the installed package so
 * updating or reinstalling the plugin does not delete the user's wallpaper.
 * The directory keeps its original name so images saved by version 1.0.x are
 * still available after the package rename.
 */
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const name = 'dsh-background-studio'

/** No mandatory services: webServer arrives through ctx.inject when present. */
export const inject = []

export const ROUTE_PREFIX = '/dsh-background-studio'

export const ROUTES = Object.freeze({
  state: `${ROUTE_PREFIX}/api/state`,
  settings: `${ROUTE_PREFIX}/api/settings`,
  imageApi: `${ROUTE_PREFIX}/api/image`,
  image: `${ROUTE_PREFIX}/image`,
})

/** Legacy data directory, intentionally kept across the package rename. */
const DATA_DIR = 'dsh-background'
const IMAGE_LIMIT = 25 * 1024 * 1024
const JSON_LIMIT = 16 * 1024
const FIT_VALUES = new Set(['cover', 'contain', 'stretch', 'tile'])

const DEFAULTS = Object.freeze({
  enabled: false,
  fit: 'cover',
  opacity: 1,
  blur: 0,
  dim: 0.18,
  surface: 0.72,
})

const IMAGE_TYPES = Object.freeze({
  'image/jpeg': { ext: 'jpg', matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': {
    ext: 'png',
    matches: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  'image/webp': {
    ext: 'webp',
    matches: (b) =>
      b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
  'image/gif': {
    ext: 'gif',
    matches: (b) => b.length >= 6 && (b.toString('ascii', 0, 6) === 'GIF87a' || b.toString('ascii', 0, 6) === 'GIF89a'),
  },
  'image/avif': {
    ext: 'avif',
    matches: (b) => {
      if (b.length < 12 || b.toString('ascii', 4, 8) !== 'ftyp') return false
      const brands = b.toString('ascii', 8, Math.min(b.length, 40))
      return brands.includes('avif') || brands.includes('avis')
    },
  },
})

/** Resolve DSH_HOME the same way the rest of the Host does. */
export function resolveDshHome(env = process.env, homedir = os.homedir) {
  const fromEnv = typeof env?.DSH_HOME === 'string' && env.DSH_HOME !== '' ? env.DSH_HOME : undefined
  if (fromEnv !== undefined) return path.resolve(fromEnv)
  try {
    const home = homedir()
    return typeof home === 'string' && home !== '' ? path.join(home, '.dsh') : undefined
  } catch {
    return undefined
  }
}

function clampNumber(value, fallback, min, max) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function normalizeImage(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const file = typeof raw.file === 'string' ? raw.file : ''
  if (file !== path.basename(file) || !/^background-[a-z0-9-]+\.(?:jpe?g|png|webp|gif|avif)$/i.test(file)) return null
  const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase()
  const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
  return {
    file,
    name: typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.slice(0, 160) : `background.${ext}`,
    contentType,
    size: clampNumber(raw.size, 0, 0, Number.MAX_SAFE_INTEGER),
    updatedAt: clampNumber(raw.updatedAt, 0, 0, Number.MAX_SAFE_INTEGER),
  }
}

/** Coerce whatever is on disk into a complete, safe settings object. */
export function normalizeSettings(raw) {
  const source = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const image = normalizeImage(source.image)
  return {
    version: 1,
    enabled: image === null ? false : source.enabled !== false,
    fit: FIT_VALUES.has(source.fit) ? source.fit : DEFAULTS.fit,
    opacity: clampNumber(source.opacity, DEFAULTS.opacity, 0.1, 1),
    blur: clampNumber(source.blur, DEFAULTS.blur, 0, 24),
    dim: clampNumber(source.dim, DEFAULTS.dim, 0, 0.8),
    surface: clampNumber(source.surface, DEFAULTS.surface, 0.15, 0.95),
    image,
  }
}

function publicSettings(settings) {
  return {
    enabled: settings.enabled,
    fit: settings.fit,
    opacity: settings.opacity,
    blur: settings.blur,
    dim: settings.dim,
    surface: settings.surface,
  }
}

function makeStore(homeDir) {
  const dir = path.join(homeDir, DATA_DIR)
  const file = path.join(dir, 'settings.json')

  const read = async () => {
    try {
      const text = await fsp.readFile(file, 'utf8')
      return normalizeSettings(JSON.parse(text))
    } catch {
      return normalizeSettings({})
    }
  }

  const write = async (settings) => {
    const next = normalizeSettings(settings)
    await fsp.mkdir(dir, { recursive: true })
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
    await fsp.writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    try {
      await fsp.rename(tmp, file)
    } catch {
      await fsp.rm(file, { force: true })
      await fsp.rename(tmp, file)
    }
    return next
  }

  return {
    dir,
    file,
    read,
    write,
    imagePath(imageFile) {
      return path.join(dir, path.basename(imageFile))
    },
  }
}

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function sendJson(res, status, body) {
  const data = Buffer.from(JSON.stringify(body))
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(data)
}

function statusOf(error) {
  return typeof error?.status === 'number' ? error.status : 500
}

function messageOf(error) {
  if (error instanceof Error && error.message) return error.message
  return 'request failed'
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let settled = false
    let size = 0
    const chunks = []
    const fail = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    req.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > limit) {
        fail(httpError(413, `request body exceeds ${limit} bytes`))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks))
    })
    req.on('error', fail)
  })
}

function displayName(value) {
  if (typeof value !== 'string' || value === '') return 'background'
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    /* keep the raw value */
  }
  return decoded.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').trim().slice(0, 160) || 'background'
}

async function removeOtherImages(store, keep) {
  let entries
  try {
    entries = await fsp.readdir(store.dir)
  } catch {
    return
  }
  await Promise.all(
    entries
      .filter((entry) => entry.startsWith('background-') && entry !== keep)
      .map((entry) => fsp.rm(path.join(store.dir, entry), { force: true }).catch(() => {})),
  )
}

async function statePayload(store) {
  let settings = await store.read()
  if (settings.image !== null) {
    try {
      const stat = await fsp.stat(store.imagePath(settings.image.file))
      settings = {
        ...settings,
        image: { ...settings.image, size: stat.size, updatedAt: Math.round(stat.mtimeMs) },
      }
    } catch {
      settings = await store.write({ ...settings, image: null, enabled: false })
    }
  }
  const image =
    settings.image === null
      ? null
      : {
          ...settings.image,
          url: `${ROUTES.image}?v=${Math.round(settings.image.updatedAt).toString(36)}-${settings.image.size.toString(36)}`,
        }
  return { settings: publicSettings(settings), image }
}

async function serveImage(req, res, store) {
  const settings = await store.read()
  if (settings.image === null) throw httpError(404, 'no background image')
  const file = store.imagePath(settings.image.file)
  let stat
  try {
    stat = await fsp.stat(file)
  } catch {
    throw httpError(404, 'background image is missing')
  }
  const etag = `"${stat.size.toString(16)}-${Math.round(stat.mtimeMs).toString(16)}"`
  const headers = {
    'Content-Type': settings.image.contentType,
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
  }
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers)
    res.end()
    return
  }
  res.writeHead(200, headers)
  if (String(req.method).toUpperCase() === 'HEAD') {
    res.end()
    return
  }
  const stream = fs.createReadStream(file)
  stream.on('error', () => res.destroy())
  stream.pipe(res)
}

async function updateSettings(req, res, store) {
  const body = await readBody(req, JSON_LIMIT)
  let patch
  try {
    patch = JSON.parse(body.toString('utf8'))
  } catch {
    throw httpError(400, 'request body is not valid JSON')
  }
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    throw httpError(400, 'request body must be a JSON object')
  }
  const current = await store.read()
  const next = { ...current }
  if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled
  if (FIT_VALUES.has(patch.fit)) next.fit = patch.fit
  for (const key of ['opacity', 'blur', 'dim', 'surface']) {
    if (typeof patch[key] === 'number' && Number.isFinite(patch[key])) next[key] = patch[key]
  }
  await store.write(next)
  sendJson(res, 200, await statePayload(store))
}

async function uploadImage(req, res, store) {
  const declaredType = String(req.headers['content-type'] ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  const contentType = declaredType === 'image/jpg' ? 'image/jpeg' : declaredType
  const type = IMAGE_TYPES[contentType]
  if (type === undefined) {
    throw httpError(415, 'unsupported image type; use JPEG, PNG, WebP, GIF or AVIF')
  }
  const declared = Number(req.headers['content-length'] ?? 0)
  if (Number.isFinite(declared) && declared > IMAGE_LIMIT) {
    throw httpError(413, 'image is larger than 25 MiB')
  }
  const body = await readBody(req, IMAGE_LIMIT)
  if (body.length === 0) throw httpError(400, 'empty image body')
  if (!type.matches(body)) throw httpError(415, 'file content does not match its image type')

  const settings = await store.read()
  const previous = settings.image?.file
  const file = `background-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}.${type.ext}`
  const target = store.imagePath(file)
  await fsp.mkdir(store.dir, { recursive: true })
  await fsp.writeFile(target, body, { flag: 'wx' })
  try {
    await store.write({
      ...settings,
      enabled: true,
      image: {
        file,
        name: displayName(req.headers['x-dsh-background-name']),
        contentType,
        size: body.length,
        updatedAt: Date.now(),
      },
    })
  } catch (error) {
    await fsp.rm(target, { force: true }).catch(() => {})
    throw error
  }
  if (previous !== undefined) await fsp.rm(store.imagePath(previous), { force: true }).catch(() => {})
  await removeOtherImages(store, file)
  sendJson(res, 200, await statePayload(store))
}

async function deleteImage(req, res, store) {
  const settings = await store.read()
  const current = settings.image?.file
  if (current !== undefined) await fsp.rm(store.imagePath(current), { force: true }).catch(() => {})
  await removeOtherImages(store, '')
  await store.write({ ...settings, enabled: false, image: null })
  sendJson(res, 200, await statePayload(store))
}

function requireMethod(req, allowed) {
  const method = String(req.method ?? 'GET').toUpperCase()
  if (!allowed.includes(method)) throw httpError(405, `use ${allowed.join(' or ')}`)
  return method
}

function wrap(handler, store, log) {
  return (req, res) => {
    Promise.resolve()
      .then(() => handler(req, res, store))
      .catch((error) => {
        if (error?.status !== 413) log('error', messageOf(error))
        if (res.headersSent) {
          res.destroy()
          return
        }
        sendJson(res, statusOf(error), { error: messageOf(error) })
      })
  }
}

function registerRoutes(child, store, log) {
  const entries = [
    [ROUTES.state, async (req, res) => {
      requireMethod(req, ['GET'])
      return sendJson(res, 200, await statePayload(store))
    }],
    [ROUTES.settings, async (req, res) => {
      requireMethod(req, ['POST'])
      return updateSettings(req, res, store)
    }],
    [ROUTES.imageApi, async (req, res) => {
      const method = requireMethod(req, ['POST', 'DELETE'])
      if (method === 'POST') return uploadImage(req, res, store)
      return deleteImage(req, res, store)
    }],
    [ROUTES.image, async (req, res) => {
      requireMethod(req, ['GET', 'HEAD'])
      return serveImage(req, res, store)
    }],
  ]
  const disposers = []
  for (const [route, handler] of entries) {
    const dispose = child.webServer.register({
      kind: 'exact',
      path: route,
      handler: wrap(handler, store, log),
    })
    if (typeof dispose === 'function') disposers.push(dispose)
    else if (dispose !== null && typeof dispose?.dispose === 'function') disposers.push(() => dispose.dispose())
  }
  return () => {
    for (const dispose of disposers.reverse()) {
      try {
        dispose()
      } catch {
        /* already gone */
      }
    }
  }
}

/** Host entry point. */
export function apply(ctx) {
  const home = resolveDshHome()
  const log = (level, message) => {
    try {
      const logger = ctx.logger
      if (logger !== null && logger !== undefined && typeof logger[level] === 'function') {
        logger[level](`[${name}] ${message}`)
      }
    } catch {
      /* logging must never be fatal */
    }
  }
  if (home === undefined) {
    log('warn', 'cannot resolve $DSH_HOME; background storage is unavailable')
    return
  }
  const store = makeStore(home)
  ctx.inject(['webServer'], (child) => {
    child.effect(() => {
      try {
        return registerRoutes(child, store, log)
      } catch (error) {
        log('error', `route registration failed: ${messageOf(error)}`)
        return () => {}
      }
    })
  })
  log('info', `ready; data directory is ${store.dir}`)
}
