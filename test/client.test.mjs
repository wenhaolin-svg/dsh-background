import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'

const source = fs.readFileSync(path.join(import.meta.dirname, '..', 'client.js'), 'utf8')

function createReactStub(overrides = []) {
  const Fragment = Symbol('Fragment')
  let stateIndex = 0
  return {
    Fragment,
    createElement(type, props, ...children) {
      let normalized = children
      if (children.length === 0) normalized = undefined
      else if (children.length === 1) normalized = children[0]
      return { type, props: { ...(props || {}), children: normalized } }
    },
    useMemo(factory) {
      return factory()
    },
    useState(initial) {
      const value = stateIndex < overrides.length ? overrides[stateIndex] : initial
      stateIndex += 1
      return [typeof value === 'function' ? value() : value, () => {}]
    },
    useRef(initial) {
      return { current: initial }
    },
    useEffect() {},
  }
}

function loadClient(React) {
  let loaded
  const window = {
    __ModuleLoader__: {
      load(config) {
        loaded = config
      },
    },
    location: { href: 'http://127.0.0.1:1/' },
    setTimeout,
    clearTimeout,
  }
  const navigator = { language: 'zh-CN' }
  vm.runInNewContext(source, { window, navigator, URL, console, setTimeout, clearTimeout })
  return loaded.factory((name) => {
    assert.equal(name, 'react')
    return React
  })
}

function mount(client) {
  const dictionaries = []
  const registrations = []
  client.apply({
    effect(callback) {
      return callback()
    },
    locale: {
      register(ns, dict) {
        dictionaries.push([ns, dict])
        return () => {}
      },
      bind() {
        return (key) => key
      },
    },
    slots: {
      inject(name, callback) {
        assert.equal(name, 'shell.overlay')
        callback()
        return () => {}
      },
      register(options, component) {
        registrations.push({ options, component })
        return () => {}
      },
    },
  })
  return { dictionaries, registrations }
}

function flatten(node, output = []) {
  if (node === null || node === undefined) return output
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, output)
    return output
  }
  output.push(node)
  if (node.props) flatten(node.props.children, output)
  return output
}

test('client module registers a shell.overlay entry and renders its empty state', () => {
  const React = createReactStub()
  const client = loadClient(React)
  assert.deepEqual(Array.from(client.inject), ['slots', 'locale'])
  const { dictionaries, registrations } = mount(client)

  assert.equal(dictionaries.length, 1)
  assert.equal(dictionaries[0][0], 'dsh-background')
  assert.deepEqual(Object.keys(dictionaries[0][1].zh).sort(), Object.keys(dictionaries[0][1].en).sort())
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].options.name, 'shell.overlay')
  assert.equal(registrations[0].options.id, 'dsh-background')

  const tree = registrations[0].component({ t: (key) => key })
  const nodes = flatten(tree)
  const style = nodes.find((node) => node.type === 'style')
  assert.ok(style)
  assert.match(style.props.dangerouslySetInnerHTML.__html, /data-dshbg/)
  const fab = nodes.find((node) => node.props && node.props.className === 'dshbg-fab')
  assert.ok(fab)
  assert.equal(fab.props['aria-label'], '背景图片')
})

test('client module renders its editor with a loaded image', () => {
  const React = createReactStub([
    { enabled: true, fit: 'tile', opacity: 0.8, blur: 6, dim: 0.2, surface: 0.6 },
    { url: '/dsh-background/image?v=1', name: 'wallpaper.png', size: 2048, contentType: 'image/png' },
    'ok',
    false,
    false,
    true,
    '',
    null,
    'saved',
    false,
    false,
    'http://127.0.0.1:1/dsh-background/image?v=1',
  ])
  const client = loadClient(React)
  const { registrations } = mount(client)
  const tree = registrations[0].component({ t: (key) => key })
  const nodes = flatten(tree)
  const dialog = nodes.find((node) => node.props && node.props.className === 'dshbg-dialog')
  assert.ok(dialog)
  const pressed = nodes.filter((node) => node.props && node.props['aria-pressed'] === 'true')
  assert.equal(pressed.length, 1)
  assert.equal(pressed[0].props.children, '平铺')
  const remove = nodes.find((node) => node.props && node.props.className === 'dshbg-btn dshbg-btn-ghost')
  assert.ok(remove)
  assert.equal(remove.props.children[1], '移除图片')
})
