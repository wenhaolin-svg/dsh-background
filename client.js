/* dsh-background — browser half. Plain script loaded by DSH's Client module loader. */
window.__ModuleLoader__.load({
  id: 'dsh-background',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState } = React

    const NS = 'dsh-background'
    const API_STATE = '/dsh-background/api/state'
    const API_SETTINGS = '/dsh-background/api/settings'
    const API_IMAGE = '/dsh-background/api/image'
    const MAX_CLIENT_FILE = 40 * 1024 * 1024
    const MAX_UPLOAD = 25 * 1024 * 1024

    const DEFAULT_SETTINGS = Object.freeze({
      enabled: true,
      fit: 'cover',
      opacity: 1,
      blur: 0,
      dim: 0.18,
      surface: 0.72,
    })

    const ZH = {
      fab: '背景图片',
      title: '背景图片',
      subtitle: '用自己的图片替换 Harness 的纯色背景',
      close: '关闭',
      enable: '启用背景',
      enableHint: '关闭后恢复默认纯色界面',
      empty: '还没有背景图片',
      emptyHint: '从电脑的任意文件夹选择一张图片，或直接拖到这里',
      drop: '松开即可导入',
      import: '选择图片',
      replace: '更换图片',
      remove: '移除图片',
      removeConfirm: '再次点击确认',
      reset: '恢复默认',
      done: '完成',
      fit: '铺满方式',
      fitCover: '铺满',
      fitContain: '完整',
      fitStretch: '拉伸',
      fitTile: '平铺',
      opacity: '图片可见度',
      blur: '背景模糊',
      dim: '背景遮罩',
      surface: '界面不透明度',
      surfaceHint: '界面越实，文字越清晰；调低会更多露出背景图',
      autosave: '修改会自动保存',
      saving: '正在保存…',
      saved: '已保存',
      saveError: '保存失败，请重试',
      loading: '正在读取…',
      uploading: '正在导入图片…',
      uploaded: '图片已更新',
      removed: '已移除背景图片',
      defaults: '已恢复默认设置',
      unsupported: '不支持这种图片格式，请使用 JPG、PNG、WebP、GIF 或 AVIF',
      tooLarge: '图片太大，请换一张小于 25 MB 的图片',
      uploadError: '导入失败，请重试',
      readError: '无法读取背景设置，请重试',
      retry: '重试',
      imageLoadError: '图片加载失败，可能文件已被移动或删除',
      image: '图片',
    }

    const EN = {
      fab: 'Background image',
      title: 'Background image',
      subtitle: 'Replace the Harness solid background with your own picture.',
      close: 'Close',
      enable: 'Enable background',
      enableHint: 'Turn off to restore the normal solid interface.',
      empty: 'No background image yet',
      emptyHint: 'Pick an image from any folder, or drop one here.',
      drop: 'Drop to import',
      import: 'Choose image',
      replace: 'Replace image',
      remove: 'Remove image',
      removeConfirm: 'Click again to confirm',
      reset: 'Reset to defaults',
      done: 'Done',
      fit: 'Fit',
      fitCover: 'Cover',
      fitContain: 'Contain',
      fitStretch: 'Stretch',
      fitTile: 'Tile',
      opacity: 'Image visibility',
      blur: 'Background blur',
      dim: 'Background veil',
      surface: 'Interface opacity',
      surfaceHint: 'Higher keeps text clearer; lower reveals more of the picture.',
      autosave: 'Changes save automatically',
      saving: 'Saving…',
      saved: 'Saved',
      saveError: 'Could not save. Try again.',
      loading: 'Loading…',
      uploading: 'Importing image…',
      uploaded: 'Image updated',
      removed: 'Background image removed',
      defaults: 'Defaults restored',
      unsupported: 'Unsupported image type. Use JPG, PNG, WebP, GIF or AVIF.',
      tooLarge: 'Image is too large. Use a file smaller than 25 MB.',
      uploadError: 'Import failed. Try again.',
      readError: 'Could not read background settings. Try again.',
      retry: 'Retry',
      imageLoadError: 'The image could not be loaded; the file may have moved or been deleted.',
      image: 'Image',
    }

    let fallback = EN
    try {
      if (String(navigator.language || '').toLowerCase().startsWith('zh')) fallback = ZH
    } catch {
      /* keep English */
    }

    function makeTranslate(bound) {
      return (key) => {
        try {
          const value = typeof bound === 'function' ? bound(key) : undefined
          if (typeof value === 'string' && value !== key) return value
        } catch {
          /* fall back below */
        }
        return fallback[key] || EN[key] || key
      }
    }

    function resolveUrl(value) {
      try {
        return new URL(value, window.location.href).href
      } catch {
        return value
      }
    }

    async function readJson(response) {
      let payload = null
      try {
        payload = await response.json()
      } catch {
        /* non-JSON error page */
      }
      if (!response.ok) {
        const error = new Error((payload && payload.error) || `HTTP ${response.status}`)
        error.status = response.status
        throw error
      }
      return payload
    }

    async function requestJson(url, init) {
      const response = await fetch(resolveUrl(url), { cache: 'no-store', ...init })
      return readJson(response)
    }

    function imageType(file) {
      const type = String(file.type || '').toLowerCase()
      if (type === 'image/jpg') return 'image/jpeg'
      if (type) return type
      const name = String(file.name || '').toLowerCase()
      if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
      if (name.endsWith('.png')) return 'image/png'
      if (name.endsWith('.webp')) return 'image/webp'
      if (name.endsWith('.gif')) return 'image/gif'
      if (name.endsWith('.avif')) return 'image/avif'
      return ''
    }

    function isSupported(type) {
      return (
        type === 'image/jpeg' ||
        type === 'image/png' ||
        type === 'image/webp' ||
        type === 'image/gif' ||
        type === 'image/avif'
      )
    }

    function fileTooLarge() {
      const error = new Error('tooLarge')
      error.key = 'tooLarge'
      return error
    }

    /**
     * Downscale very large still images before upload. Animated GIF/AVIF are
     * left alone so animation is preserved; SVG is rejected for safety.
     */
    async function prepareImage(file, type) {
      if (file.size > MAX_CLIENT_FILE) throw fileTooLarge()
      if (type === 'image/gif' || type === 'image/avif') {
        if (file.size > MAX_UPLOAD) throw fileTooLarge()
        return { blob: file, type, name: file.name }
      }
      let bitmap
      try {
        bitmap = await createImageBitmap(file)
      } catch {
        if (file.size > MAX_UPLOAD) throw fileTooLarge()
        return { blob: file, type, name: file.name }
      }
      try {
        const longest = Math.max(bitmap.width, bitmap.height)
        if (longest <= 4096 && file.size <= 8 * 1024 * 1024) {
          return { blob: file, type, name: file.name }
        }
        const scale = Math.min(1, 4096 / longest)
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) {
          if (file.size > MAX_UPLOAD) throw fileTooLarge()
          return { blob: file, type, name: file.name }
        }
        context.drawImage(bitmap, 0, 0, width, height)
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
        if (!blob || blob.size >= file.size) {
          if (file.size > MAX_UPLOAD) throw fileTooLarge()
          return { blob: file, type, name: file.name }
        }
        return { blob, type: 'image/webp', name: (file.name || 'background').replace(/\.[^.]+$/, '') + '.webp' }
      } finally {
        try {
          bitmap.close()
        } catch {
          /* not critical */
        }
      }
    }

    function fitCss(fit) {
      if (fit === 'contain') return { size: 'contain', repeat: 'no-repeat' }
      if (fit === 'stretch') return { size: '100% 100%', repeat: 'no-repeat' }
      if (fit === 'tile') return { size: 'auto', repeat: 'repeat' }
      return { size: 'cover', repeat: 'no-repeat' }
    }

    function pct(value) {
      return `${Math.round(value * 100)}%`
    }

    function formatBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes <= 0) return ''
      if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    function IconImage({ size = 20 }) {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2.5 }),
        h('circle', { cx: 8.5, cy: 9, r: 1.4 }),
        h('path', { d: 'm4 17 4.6-4.7a1.8 1.8 0 0 1 2.6 0l1.7 1.8 1.7-1.7a1.8 1.8 0 0 1 2.6 0L20 15.2' }),
      )
    }

    function IconClose({ size = 18 }) {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'M6 6l12 12M18 6 6 18' }),
      )
    }

    function IconUpload({ size = 18 }) {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'M12 16V4' }),
        h('path', { d: 'm7.5 8.5 4.5-4.5 4.5 4.5' }),
        h('path', { d: 'M4.5 15.5v2.7A1.8 1.8 0 0 0 6.3 20h11.4a1.8 1.8 0 0 0 1.8-1.8v-2.7' }),
      )
    }

    function IconTrash({ size = 16 }) {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'M4.5 7h15' }),
        h('path', { d: 'M9 7V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8V7' }),
        h('path', { d: 'm6.5 7 .8 12.1a1.4 1.4 0 0 0 1.4 1.3h6.6a1.4 1.4 0 0 0 1.4-1.3L17.5 7' }),
        h('path', { d: 'M10 11v5.5M14 11v5.5' }),
      )
    }

    function IconReset({ size = 16 }) {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'M4.5 9.5A7.7 7.7 0 1 1 4.5 15' }),
        h('path', { d: 'M4.5 4.5v5h5' }),
      )
    }

    function IconCheck({ size = 14 }) {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'm5 12.5 4.5 4.5L19 7.5' }),
      )
    }

    function Divider() {
      return h('div', { className: 'dshbg-divider' })
    }

    function Switch({ checked, disabled, label, onChange }) {
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': checked ? 'true' : 'false',
          className: `dshbg-switch${checked ? ' is-on' : ''}`,
          disabled,
          onClick: () => onChange(!checked),
        },
        h('span', { className: 'dshbg-switch-track', 'aria-hidden': 'true' }, h('span', { className: 'dshbg-switch-thumb' })),
        h('span', { className: 'dshbg-switch-label' }, label),
      )
    }

    function Slider({ label, value, min, max, step, display, onChange }) {
      return h(
        'label',
        { className: 'dshbg-field' },
        h(
          'span',
          { className: 'dshbg-field-head' },
          h('span', null, label),
          h('span', { className: 'dshbg-field-value' }, display),
        ),
        h('input', {
          className: 'dshbg-range',
          type: 'range',
          min,
          max,
          step,
          value,
          onChange: (event) => onChange(Number(event.target.value)),
        }),
      )
    }

    const CSS = `
html[data-dshbg="on"] { background: #eef1f5; }
html[data-dshbg="on"]:has(body[data-ds-dark-theme]) { background: #0e1116; }
html[data-dshbg="on"] body { background: transparent !important; }
html[data-dshbg="on"] body::before {
  content: "";
  position: fixed;
  inset: -36px;
  z-index: -1;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255, 255, 255, var(--dshbg-dim, 0.18)), rgba(255, 255, 255, var(--dshbg-dim, 0.18))),
    var(--dshbg-image);
  background-size: 100% 100%, var(--dshbg-size, cover);
  background-position: center;
  background-repeat: no-repeat, var(--dshbg-repeat, no-repeat);
  opacity: var(--dshbg-opacity, 1);
  filter: blur(var(--dshbg-blur, 0px));
  transition: opacity 280ms ease;
}
html[data-dshbg="on"] body[data-ds-dark-theme]::before {
  background-image:
    linear-gradient(rgba(0, 0, 0, var(--dshbg-dim, 0.18)), rgba(0, 0, 0, var(--dshbg-dim, 0.18))),
    var(--dshbg-image);
}
html[data-dshbg="on"] body {
  --dsw-alias-bg-base: rgba(255, 255, 255, var(--dshbg-surface-light, 0.72)) !important;
  --dsw-alias-bg-layer-1: rgba(255, 255, 255, var(--dshbg-layer1-light, 0.8)) !important;
  --dsw-alias-bg-layer-2: rgba(255, 255, 255, var(--dshbg-layer2-light, 0.86)) !important;
  --dsw-alias-bg-layer-3: rgba(255, 255, 255, var(--dshbg-layer3-light, 0.9)) !important;
  --dsw-specific-sidebar-fill: rgba(249, 250, 251, var(--dshbg-sidebar-light, 0.77)) !important;
}
html[data-dshbg="on"] body[data-ds-dark-theme] {
  --dsw-alias-bg-base: rgba(18, 18, 20, var(--dshbg-surface-dark, 0.56)) !important;
  --dsw-alias-bg-layer-1: rgba(30, 30, 32, var(--dshbg-layer1-dark, 0.65)) !important;
  --dsw-alias-bg-layer-2: rgba(36, 36, 38, var(--dshbg-layer2-dark, 0.72)) !important;
  --dsw-alias-bg-layer-3: rgba(42, 42, 44, var(--dshbg-layer3-dark, 0.78)) !important;
  --dsw-specific-sidebar-fill: rgba(24, 24, 26, var(--dshbg-sidebar-dark, 0.62)) !important;
}

.dshbg-fab {
  all: unset;
  box-sizing: border-box;
  position: fixed;
  right: 16px;
  top: 50%;
  bottom: auto;
  z-index: 30;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--dsw-alias-label-secondary, #61666b);
  background: rgba(255, 255, 255, 0.7);
  border: 0.5px solid var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.12));
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.13);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  cursor: pointer;
  opacity: 0.34;
  transition: opacity 160ms ease, transform 160ms ease, background 160ms ease;
  -webkit-user-select: none;
  user-select: none;
}
.dshbg-fab:hover,
.dshbg-fab:focus-visible,
.dshbg-fab[data-active="true"] { opacity: 1; transform: translateY(-50%) scale(1.04); }
.dshbg-fab:active { transform: translateY(-50%) scale(0.97); }
.dshbg-fab:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #4176e6); outline-offset: 2px; }
body[data-ds-dark-theme] .dshbg-fab {
  color: var(--dsw-alias-label-secondary, #cfd3d6);
  background: rgba(28, 28, 31, 0.72);
  border-color: var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.14));
}
.dshbg-fab-dot {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dsw-alias-state-business-primary, #4176e6);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.82);
}
body[data-ds-dark-theme] .dshbg-fab-dot { box-shadow: 0 0 0 2px rgba(28, 28, 31, 0.92); }

.dshbg-mask {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(9, 11, 15, 0.55);
  -webkit-backdrop-filter: blur(7px);
  backdrop-filter: blur(7px);
  animation: dshbg-fade 170ms ease-out both;
}
.dshbg-dialog {
  width: min(600px, 100%);
  max-height: calc(100vh - 40px);
  overflow: auto;
  box-sizing: border-box;
  padding: 22px;
  border-radius: 16px;
  color: var(--dsw-alias-label-primary, #0f1115);
  background: rgba(255, 255, 255, 0.98);
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif);
  animation: dshbg-rise 190ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
body[data-ds-dark-theme] .dshbg-dialog {
  background: rgba(28, 28, 31, 0.98);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
}
.dshbg-dialog * { box-sizing: border-box; }
.dshbg-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.dshbg-head-main { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
.dshbg-badge {
  flex: none;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, #4c8dff, #7558e8);
  box-shadow: 0 8px 20px rgba(76, 141, 255, 0.3);
}
.dshbg-title { margin: 0; font-size: 18px; line-height: 1.25; font-weight: 600; letter-spacing: -0.01em; }
.dshbg-sub { margin: 5px 0 0; font-size: 12.5px; line-height: 1.45; color: var(--dsw-alias-label-tertiary, #81858c); }
.dshbg-icon-btn {
  all: unset;
  flex: none;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--dsw-alias-label-tertiary, #81858c);
  cursor: pointer;
}
.dshbg-icon-btn:hover { background: rgba(0, 0, 0, 0.06); color: var(--dsw-alias-label-primary, #0f1115); }
body[data-ds-dark-theme] .dshbg-icon-btn:hover { background: rgba(255, 255, 255, 0.09); color: var(--dsw-alias-label-primary, #f9fafb); }
.dshbg-icon-btn:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #4176e6); outline-offset: 1px; }

.dshbg-preview {
  position: relative;
  height: 214px;
  margin-top: 18px;
  overflow: hidden;
  border-radius: 12px;
  border: 0.5px solid var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.12));
  background-color: #e9edf2;
  background-image:
    linear-gradient(45deg, #d9e0e7 25%, transparent 25%),
    linear-gradient(-45deg, #d9e0e7 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #d9e0e7 75%),
    linear-gradient(-45deg, transparent 75%, #d9e0e7 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  cursor: default;
}
body[data-ds-dark-theme] .dshbg-preview {
  background-color: #24262b;
  background-image:
    linear-gradient(45deg, #2e3138 25%, transparent 25%),
    linear-gradient(-45deg, #2e3138 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2e3138 75%),
    linear-gradient(-45deg, transparent 75%, #2e3138 75%);
}
.dshbg-preview[data-empty="true"] { cursor: pointer; }
.dshbg-preview.is-drag { border-color: var(--dsw-alias-state-business-primary, #4176e6); box-shadow: inset 0 0 0 2px var(--dsw-alias-state-business-primary, #4176e6); }
.dshbg-preview-image {
  position: absolute;
  inset: 0;
  background-position: center;
  background-repeat: no-repeat;
  pointer-events: none;
}
.dshbg-preview-veil { position: absolute; inset: 0; pointer-events: none; background: rgba(255, 255, 255, var(--dshbg-preview-dim, 0.18)); }
body[data-ds-dark-theme] .dshbg-preview-veil { background: rgba(0, 0, 0, var(--dshbg-preview-dim, 0.18)); }
.dshbg-preview-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 20px;
  text-align: center;
  color: var(--dsw-alias-label-secondary, #61666b);
}
body[data-ds-dark-theme] .dshbg-preview-empty { color: var(--dsw-alias-label-secondary, #cfd3d6); }
.dshbg-preview-empty-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 0.5px solid var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.1));
}
body[data-ds-dark-theme] .dshbg-preview-empty-icon { background: rgba(255, 255, 255, 0.08); }
.dshbg-preview-empty-title { font-size: 13px; font-weight: 600; }
.dshbg-preview-empty-hint { max-width: 340px; font-size: 11.5px; line-height: 1.5; color: var(--dsw-alias-label-tertiary, #81858c); }
.dshbg-preview-chip {
  position: absolute;
  left: 10px;
  bottom: 10px;
  max-width: calc(100% - 20px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 4px 9px;
  border-radius: 999px;
  color: #fff;
  background: rgba(8, 12, 18, 0.48);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  font-size: 11.5px;
  line-height: 1.4;
}
.dshbg-preview-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 3px 8px;
  border-radius: 999px;
  color: #fff;
  background: rgba(8, 12, 18, 0.48);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  font-size: 10.5px;
  letter-spacing: 0.02em;
}

.dshbg-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
.dshbg-btn {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.2;
  color: var(--dsw-alias-label-primary, #0f1115);
  background: rgba(0, 0, 0, 0.055);
  border: 0.5px solid transparent;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, opacity 150ms ease;
  -webkit-user-select: none;
  user-select: none;
}
body[data-ds-dark-theme] .dshbg-btn { background: rgba(255, 255, 255, 0.08); color: var(--dsw-alias-label-primary, #f9fafb); }
.dshbg-btn:hover { background: rgba(0, 0, 0, 0.09); }
body[data-ds-dark-theme] .dshbg-btn:hover { background: rgba(255, 255, 255, 0.13); }
.dshbg-btn:focus-visible,
.dshbg-primary:focus-visible,
.dshbg-text-btn:focus-visible,
.dshbg-seg button:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #4176e6); outline-offset: 2px; }
.dshbg-btn:disabled,
.dshbg-primary:disabled,
.dshbg-text-btn:disabled,
.dshbg-switch:disabled { opacity: 0.45; cursor: not-allowed; }
.dshbg-btn-ghost { background: transparent; color: var(--dsw-alias-label-secondary, #61666b); }
body[data-ds-dark-theme] .dshbg-btn-ghost { background: transparent; color: var(--dsw-alias-label-secondary, #cfd3d6); }
.dshbg-btn-ghost:hover { background: rgba(0, 0, 0, 0.055); }
body[data-ds-dark-theme] .dshbg-btn-ghost:hover { background: rgba(255, 255, 255, 0.08); }
.dshbg-btn-danger { color: var(--dsw-alias-state-error-primary, #d04444); }
.dshbg-primary {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 6px 18px;
  border-radius: 8px;
  color: #fff;
  background: var(--dsw-alias-state-business-primary, #4176e6);
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  transition: filter 150ms ease, opacity 150ms ease;
  -webkit-user-select: none;
  user-select: none;
}
.dshbg-primary:hover { filter: brightness(1.06); }
.dshbg-text-btn {
  all: unset;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 2px;
  border-radius: 6px;
  color: var(--dsw-alias-label-tertiary, #81858c);
  font-size: 12px;
  cursor: pointer;
}
.dshbg-text-btn:hover { color: var(--dsw-alias-label-primary, #0f1115); }
body[data-ds-dark-theme] .dshbg-text-btn:hover { color: var(--dsw-alias-label-primary, #f9fafb); }
.dshbg-file-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-tertiary, #81858c); font-size: 11.5px; }

.dshbg-divider { height: 0.5px; margin: 16px 0; background: var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.12)); }
.dshbg-enable-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dshbg-enable-hint { margin-top: 3px; font-size: 11.5px; color: var(--dsw-alias-label-tertiary, #81858c); }
.dshbg-switch { all: unset; display: inline-flex; align-items: center; gap: 9px; cursor: pointer; }
.dshbg-switch-track {
  position: relative;
  width: 34px;
  height: 20px;
  flex: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.18);
  transition: background 150ms ease;
}
body[data-ds-dark-theme] .dshbg-switch-track { background: rgba(255, 255, 255, 0.18); }
.dshbg-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  transition: left 150ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.dshbg-switch.is-on .dshbg-switch-track { background: var(--dsw-alias-state-business-primary, #4176e6); }
.dshbg-switch.is-on .dshbg-switch-thumb { left: 16px; }
.dshbg-switch-label { font-size: 12.5px; color: var(--dsw-alias-label-primary, #0f1115); }
body[data-ds-dark-theme] .dshbg-switch-label { color: var(--dsw-alias-label-primary, #f9fafb); }
.dshbg-switch:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary, #4176e6); outline-offset: 3px; border-radius: 999px; }

.dshbg-section-label { font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-secondary, #61666b); margin-bottom: 7px; }
.dshbg-seg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; padding: 3px; border-radius: 9px; background: rgba(0, 0, 0, 0.045); }
body[data-ds-dark-theme] .dshbg-seg { background: rgba(255, 255, 255, 0.07); }
.dshbg-seg button {
  all: unset;
  text-align: center;
  padding: 5px 2px;
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary, #61666b);
  font-size: 11.5px;
  line-height: 1.3;
  cursor: pointer;
}
.dshbg-seg button:hover { background: rgba(0, 0, 0, 0.05); }
body[data-ds-dark-theme] .dshbg-seg button:hover { background: rgba(255, 255, 255, 0.07); }
.dshbg-seg button[aria-pressed="true"] {
  color: var(--dsw-alias-label-primary, #0f1115);
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  font-weight: 600;
}
body[data-ds-dark-theme] .dshbg-seg button[aria-pressed="true"] {
  color: var(--dsw-alias-label-primary, #f9fafb);
  background: rgba(255, 255, 255, 0.16);
}
.dshbg-field { display: block; margin-top: 13px; }
.dshbg-field-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--dsw-alias-label-secondary, #61666b); }
.dshbg-field-value { color: var(--dsw-alias-label-tertiary, #81858c); font-variant-numeric: tabular-nums; }
.dshbg-range {
  display: block;
  width: 100%;
  height: 20px;
  margin: 2px 0 0;
  accent-color: var(--dsw-alias-state-business-primary, #4176e6);
  cursor: pointer;
}
.dshbg-hint { margin-top: 5px; font-size: 11px; line-height: 1.45; color: var(--dsw-alias-label-tertiary, #81858c); }

.dshbg-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--dsw-alias-state-error-primary, #c23b3b);
  background: rgba(200, 48, 48, 0.09);
}
.dshbg-banner button { all: unset; flex: none; cursor: pointer; font-weight: 600; text-decoration: underline; }
.dshbg-notice { margin-top: 10px; font-size: 11.5px; line-height: 1.45; }
.dshbg-notice[data-kind="ok"] { color: var(--dsw-alias-state-success-primary, #17864b); }
.dshbg-notice[data-kind="error"] { color: var(--dsw-alias-state-error-primary, #c23b3b); }
.dshbg-status { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--dsw-alias-label-tertiary, #81858c); }
.dshbg-status[data-kind="ok"] { color: var(--dsw-alias-state-success-primary, #17864b); }
.dshbg-status[data-kind="error"] { color: var(--dsw-alias-state-error-primary, #c23b3b); }
.dshbg-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 18px; padding-top: 14px; border-top: 0.5px solid var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.12)); }
.dshbg-foot-left { display: flex; align-items: center; gap: 12px; min-width: 0; }

@keyframes dshbg-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes dshbg-rise { from { opacity: 0; transform: translateY(8px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
@media (prefers-reduced-motion: reduce) {
  .dshbg-mask, .dshbg-dialog { animation: none; }
  .dshbg-fab, .dshbg-btn, .dshbg-primary, .dshbg-switch-track, .dshbg-switch-thumb, .dshbg-preview-image { transition: none; }
}
@media (max-width: 560px) {
  .dshbg-mask { padding: 12px; }
  .dshbg-dialog { max-height: calc(100vh - 24px); padding: 18px; border-radius: 14px; }
  .dshbg-preview { height: 170px; }
  .dshbg-foot { flex-direction: column; align-items: stretch; }
  .dshbg-foot .dshbg-primary { width: 100%; }
}
`

    function BackgroundPanel({ t }) {
      const tr = useMemo(() => makeTranslate(t), [t])
      const [settings, setSettings] = useState(DEFAULT_SETTINGS)
      const [image, setImage] = useState(null)
      const [imageStatus, setImageStatus] = useState('idle')
      const [loading, setLoading] = useState(true)
      const [loadError, setLoadError] = useState(false)
      const [open, setOpen] = useState(false)
      const [busy, setBusy] = useState('')
      const [notice, setNotice] = useState(null)
      const [saveStatus, setSaveStatus] = useState('idle')
      const [dragging, setDragging] = useState(false)
      const [confirmRemove, setConfirmRemove] = useState(false)
      const [imageProbeUrl, setImageProbeUrl] = useState('')
      const [probeNonce, setProbeNonce] = useState(0)

      const settingsRef = useRef(DEFAULT_SETTINGS)
      const loadedRef = useRef(false)
      const dirtyRef = useRef(false)
      const saveTimer = useRef(null)
      const saveSeq = useRef(0)
      const fileInputRef = useRef(null)
      const primaryActionRef = useRef(null)
      const dialogRef = useRef(null)
      const closeRef = useRef(() => {})

      const imageUrl = image && typeof image.url === 'string' ? resolveUrl(image.url) : ''
      const active = Boolean(image && settings.enabled && imageStatus !== 'error')
      const fit = fitCss(settings.fit)

      function applyState(payload) {
        if (payload && payload.settings) {
          const next = { ...DEFAULT_SETTINGS, ...payload.settings }
          settingsRef.current = next
          setSettings(next)
        }
        setImage(payload && payload.image ? payload.image : null)
        loadedRef.current = true
        setLoading(false)
      }

      async function loadState() {
        setLoading(true)
        setLoadError(false)
        try {
          const payload = await requestJson(API_STATE)
          applyState(payload)
        } catch {
          setLoadError(true)
          setLoading(false)
        }
      }

      useEffect(() => {
        void loadState()
        return () => {
          if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
        }
      }, [])

      useEffect(() => {
        if (imageUrl === '') {
          setImageStatus('idle')
          setImageProbeUrl('')
          return
        }
        setImageStatus('loading')
        setImageProbeUrl(imageUrl)
        if (typeof window.Image !== 'function') {
          setImageStatus('ok')
          return
        }
        let cancelled = false
        const probe = new window.Image()
        probe.decoding = 'async'
        probe.onload = () => {
          if (!cancelled) setImageStatus('ok')
        }
        probe.onerror = () => {
          if (!cancelled) setImageStatus('error')
        }
        probe.src = imageUrl
        return () => {
          cancelled = true
          probe.onload = null
          probe.onerror = null
          probe.src = ''
        }
      }, [imageUrl, probeNonce])

      useEffect(() => {
        const root = document.documentElement
        const props = [
          '--dshbg-image',
          '--dshbg-size',
          '--dshbg-repeat',
          '--dshbg-opacity',
          '--dshbg-blur',
          '--dshbg-dim',
          '--dshbg-surface-light',
          '--dshbg-layer1-light',
          '--dshbg-layer2-light',
          '--dshbg-layer3-light',
          '--dshbg-sidebar-light',
          '--dshbg-surface-dark',
          '--dshbg-layer1-dark',
          '--dshbg-layer2-dark',
          '--dshbg-layer3-dark',
          '--dshbg-sidebar-dark',
        ]
        if (!active) {
          root.removeAttribute('data-dshbg')
          for (const prop of props) root.style.removeProperty(prop)
          return
        }
        const surface = Math.min(0.95, Math.max(0.15, Number(settings.surface) || 0.72))
        const dark = Math.min(0.95, Math.max(0.15, surface * 0.78))
        const value = (number) => String(Math.round(number * 1000) / 1000)
        root.setAttribute('data-dshbg', 'on')
        root.style.setProperty('--dshbg-image', `url("${imageUrl.replace(/"/g, '%22')}")`)
        root.style.setProperty('--dshbg-size', fit.size)
        root.style.setProperty('--dshbg-repeat', fit.repeat)
        root.style.setProperty('--dshbg-opacity', value(Math.min(1, Math.max(0.1, settings.opacity))))
        root.style.setProperty('--dshbg-blur', `${Math.round(Math.min(24, Math.max(0, settings.blur)))}px`)
        root.style.setProperty('--dshbg-dim', value(Math.min(0.8, Math.max(0, settings.dim))))
        root.style.setProperty('--dshbg-surface-light', value(surface))
        root.style.setProperty('--dshbg-layer1-light', value(Math.min(1, surface + 0.08)))
        root.style.setProperty('--dshbg-layer2-light', value(Math.min(1, surface + 0.14)))
        root.style.setProperty('--dshbg-layer3-light', value(Math.min(1, surface + 0.18)))
        root.style.setProperty('--dshbg-sidebar-light', value(Math.min(1, surface + 0.05)))
        root.style.setProperty('--dshbg-surface-dark', value(dark))
        root.style.setProperty('--dshbg-layer1-dark', value(Math.min(1, dark + 0.09)))
        root.style.setProperty('--dshbg-layer2-dark', value(Math.min(1, dark + 0.16)))
        root.style.setProperty('--dshbg-layer3-dark', value(Math.min(1, dark + 0.22)))
        root.style.setProperty('--dshbg-sidebar-dark', value(Math.min(1, dark + 0.06)))
        return () => {
          root.removeAttribute('data-dshbg')
          for (const prop of props) root.style.removeProperty(prop)
        }
      }, [
        active,
        imageUrl,
        fit.size,
        fit.repeat,
        settings.opacity,
        settings.blur,
        settings.dim,
        settings.surface,
      ])

      useEffect(() => {
        if (!notice) return
        const timer = window.setTimeout(() => setNotice(null), 4200)
        return () => window.clearTimeout(timer)
      }, [notice])

      useEffect(() => {
        if (!confirmRemove) return
        const timer = window.setTimeout(() => setConfirmRemove(false), 3200)
        return () => window.clearTimeout(timer)
      }, [confirmRemove])

      useEffect(() => {
        if (!open) return
        const previous = document.activeElement
        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            closeRef.current()
            return
          }
          if (event.key !== 'Tab' || !dialogRef.current) return
          const focusables = Array.from(
            dialogRef.current.querySelectorAll(
              'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((node) => node.offsetParent !== null)
          if (focusables.length === 0) return
          const first = focusables[0]
          const last = focusables[focusables.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
        document.addEventListener('keydown', onKey, true)
        const focusTimer = window.setTimeout(() => {
          if (primaryActionRef.current) primaryActionRef.current.focus()
        }, 30)
        return () => {
          document.removeEventListener('keydown', onKey, true)
          window.clearTimeout(focusTimer)
          if (previous && typeof previous.focus === 'function') previous.focus()
        }
      }, [open])

      useEffect(() => {
        if (!open) return
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
          document.body.style.overflow = previous
        }
      }, [open])

      useEffect(() => {
        if (!open) setConfirmRemove(false)
      }, [open])

      function cancelScheduledSave() {
        if (saveTimer.current !== null) {
          window.clearTimeout(saveTimer.current)
          saveTimer.current = null
        }
        dirtyRef.current = false
        saveSeq.current += 1
      }

      async function persist(next) {
        const seq = ++saveSeq.current
        setSaveStatus('saving')
        try {
          const payload = await requestJson(API_SETTINGS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(next),
          })
          if (seq !== saveSeq.current) return
          dirtyRef.current = false
          setSaveStatus('saved')
          if (payload) setImage(payload.image || null)
        } catch {
          if (seq === saveSeq.current) {
            setSaveStatus('error')
            setNotice({ kind: 'error', text: tr('saveError') })
          }
        }
      }

      function scheduleSave(next) {
        dirtyRef.current = true
        setSaveStatus('saving')
        if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => {
          saveTimer.current = null
          void persist(next)
        }, 450)
      }

      function update(patch) {
        const next = { ...settingsRef.current, ...patch }
        settingsRef.current = next
        setSettings(next)
        if (loadedRef.current) scheduleSave(next)
      }

      function flushSave() {
        if (saveTimer.current !== null) {
          window.clearTimeout(saveTimer.current)
          saveTimer.current = null
        }
        if (dirtyRef.current) void persist(settingsRef.current)
      }

      function closePanel() {
        flushSave()
        setOpen(false)
      }
      closeRef.current = closePanel

      async function importFile(file) {
        if (!file) return
        const type = imageType(file)
        if (!isSupported(type)) {
          setNotice({ kind: 'error', text: tr('unsupported') })
          return
        }
        if (file.size > MAX_CLIENT_FILE) {
          setNotice({ kind: 'error', text: tr('tooLarge') })
          return
        }
        cancelScheduledSave()
        setBusy('upload')
        setNotice(null)
        try {
          const prepared = await prepareImage(file, type)
          if (prepared.blob.size > MAX_UPLOAD) throw fileTooLarge()
          const response = await fetch(resolveUrl(API_IMAGE), {
            method: 'POST',
            cache: 'no-store',
            headers: {
              'Content-Type': prepared.type,
              'X-DSH-Background-Name': encodeURIComponent(prepared.name || file.name || 'background'),
            },
            body: prepared.blob,
          })
          const payload = await readJson(response)
          applyState(payload)
          setConfirmRemove(false)
          setSaveStatus('idle')
          setNotice({ kind: 'ok', text: tr('uploaded') })
        } catch (error) {
          if (error && error.key === 'tooLarge') setNotice({ kind: 'error', text: tr('tooLarge') })
          else if (error && error.status === 413) setNotice({ kind: 'error', text: tr('tooLarge') })
          else setNotice({ kind: 'error', text: tr('uploadError') })
        } finally {
          setBusy('')
        }
      }

      async function removeImage() {
        if (!confirmRemove) {
          setConfirmRemove(true)
          return
        }
        setConfirmRemove(false)
        cancelScheduledSave()
        setBusy('remove')
        setNotice(null)
        try {
          const payload = await requestJson(API_IMAGE, { method: 'DELETE' })
          applyState(payload)
          setSaveStatus('idle')
          setNotice({ kind: 'ok', text: tr('removed') })
        } catch {
          setNotice({ kind: 'error', text: tr('uploadError') })
        } finally {
          setBusy('')
        }
      }

      function resetDefaults() {
        if (!image) return
        update({ ...DEFAULT_SETTINGS, enabled: true })
        setNotice({ kind: 'ok', text: tr('defaults') })
      }

      function pickFile() {
        if (fileInputRef.current) fileInputRef.current.click()
      }

      function onFileChange(event) {
        const file = event.target.files && event.target.files[0]
        event.target.value = ''
        if (file) void importFile(file)
      }

      function onDrop(event) {
        event.preventDefault()
        setDragging(false)
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]
        if (file) void importFile(file)
      }

      const saveKind = saveStatus === 'saved' ? 'ok' : saveStatus === 'error' ? 'error' : 'idle'
      const saveText =
        saveStatus === 'saving'
          ? tr('saving')
          : saveStatus === 'saved'
            ? tr('saved')
            : saveStatus === 'error'
              ? tr('saveError')
              : tr('autosave')

      const preview = h(
        'div',
        {
          className: `dshbg-preview${dragging ? ' is-drag' : ''}`,
          'data-empty': image ? 'false' : 'true',
          role: image ? undefined : 'button',
          tabIndex: image ? undefined : 0,
          onClick: image ? undefined : pickFile,
          onKeyDown: image
            ? undefined
            : (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  pickFile()
                }
              },
          onDragEnter: (event) => {
            event.preventDefault()
            setDragging(true)
          },
          onDragOver: (event) => {
            event.preventDefault()
            setDragging(true)
          },
          onDragLeave: () => setDragging(false),
          onDrop,
        },
        image && imageProbeUrl
          ? h('div', {
              className: 'dshbg-preview-image',
              style: {
                backgroundImage: `url("${imageProbeUrl.replace(/"/g, '%22')}")`,
                backgroundSize: fit.size,
                backgroundRepeat: fit.repeat,
                opacity: Math.min(1, Math.max(0.1, settings.opacity)),
              },
            })
          : null,
        image ? h('div', { className: 'dshbg-preview-veil', style: { '--dshbg-preview-dim': String(settings.dim) } }) : null,
        image
          ? h('div', { className: 'dshbg-preview-chip', title: image.name }, image.name || tr('image'))
          : h(
              'div',
              { className: 'dshbg-preview-empty' },
              h('div', { className: 'dshbg-preview-empty-icon' }, h(IconImage, { size: 21 })),
              h('div', { className: 'dshbg-preview-empty-title' }, dragging ? tr('drop') : tr('empty')),
              h('div', { className: 'dshbg-preview-empty-hint' }, tr('emptyHint')),
            ),
        image
          ? h(
              'div',
              { className: 'dshbg-preview-badge' },
              `${Math.round(settings.opacity * 100)}% · ${tr(`fit${settings.fit.charAt(0).toUpperCase()}${settings.fit.slice(1)}`)}`,
            )
          : null,
      )

      const dialog = open
        ? h(
            'div',
            {
              className: 'dshbg-mask',
              onMouseDown: (event) => {
                if (event.target === event.currentTarget) closePanel()
              },
            },
            h(
              'div',
              {
                ref: dialogRef,
                className: 'dshbg-dialog',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': 'dshbg-title',
                tabIndex: -1,
              },
              h(
                'div',
                { className: 'dshbg-head' },
                h(
                  'div',
                  { className: 'dshbg-head-main' },
                  h('div', { className: 'dshbg-badge', 'aria-hidden': 'true' }, h(IconImage, { size: 21 })),
                  h(
                    'div',
                    null,
                    h('h2', { id: 'dshbg-title', className: 'dshbg-title' }, tr('title')),
                    h('p', { className: 'dshbg-sub' }, tr('subtitle')),
                  ),
                ),
                h(
                  'button',
                  { type: 'button', className: 'dshbg-icon-btn', 'aria-label': tr('close'), title: tr('close'), onClick: closePanel },
                  h(IconClose),
                ),
              ),
              preview,
              h(
                'div',
                { className: 'dshbg-actions' },
                h(
                  'button',
                  {
                    ref: primaryActionRef,
                    type: 'button',
                    className: 'dshbg-btn',
                    disabled: busy !== '',
                    onClick: pickFile,
                  },
                  h(IconUpload),
                  busy === 'upload' ? tr('uploading') : image ? tr('replace') : tr('import'),
                ),
                image
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: `dshbg-btn dshbg-btn-ghost${confirmRemove ? ' dshbg-btn-danger' : ''}`,
                        disabled: busy !== '',
                        onClick: () => void removeImage(),
                      },
                      h(IconTrash),
                      confirmRemove ? tr('removeConfirm') : tr('remove'),
                    )
                  : null,
                h('span', { className: 'dshbg-file-name', title: image ? image.name : '' }, image ? formatBytes(image.size) : ''),
              ),
              imageStatus === 'error'
                ? h(
                    'div',
                    { className: 'dshbg-banner' },
                    h('span', null, tr('imageLoadError')),
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: () => {
                          setProbeNonce((value) => value + 1)
                          void loadState()
                        },
                      },
                      tr('retry'),
                    ),
                  )
                : null,
              loadError
                ? h(
                    'div',
                    { className: 'dshbg-banner' },
                    h('span', null, tr('readError')),
                    h('button', { type: 'button', onClick: () => void loadState() }, tr('retry')),
                  )
                : null,
              loading && !loadError
                ? h('div', { className: 'dshbg-hint', style: { marginTop: '12px' } }, tr('loading'))
                : h(
                    React.Fragment,
                    null,
                    h('div', { className: 'dshbg-divider' }),
                    h(
                      'div',
                      { className: 'dshbg-enable-row' },
                      h(
                        'div',
                        null,
                        h(Switch, {
                          checked: settings.enabled && Boolean(image),
                          disabled: !image || busy !== '',
                          label: tr('enable'),
                          onChange: (checked) => update({ enabled: checked }),
                        }),
                        h('div', { className: 'dshbg-enable-hint' }, tr('enableHint')),
                      ),
                    ),
                    h('div', { className: 'dshbg-divider' }),
                    h('div', { className: 'dshbg-section-label' }, tr('fit')),
                    h(
                      'div',
                      { className: 'dshbg-seg', role: 'group', 'aria-label': tr('fit') },
                      ['cover', 'contain', 'stretch', 'tile'].map((value) =>
                        h(
                          'button',
                          {
                            key: value,
                            type: 'button',
                            'aria-pressed': settings.fit === value ? 'true' : 'false',
                            onClick: () => update({ fit: value }),
                          },
                          tr(value === 'cover' ? 'fitCover' : value === 'contain' ? 'fitContain' : value === 'stretch' ? 'fitStretch' : 'fitTile'),
                        ),
                      ),
                    ),
                    h(Slider, {
                      label: tr('opacity'),
                      value: settings.opacity,
                      min: 0.1,
                      max: 1,
                      step: 0.01,
                      display: pct(settings.opacity),
                      onChange: (value) => update({ opacity: value }),
                    }),
                    h(Slider, {
                      label: tr('blur'),
                      value: settings.blur,
                      min: 0,
                      max: 24,
                      step: 1,
                      display: `${Math.round(settings.blur)}px`,
                      onChange: (value) => update({ blur: value }),
                    }),
                    h(Slider, {
                      label: tr('dim'),
                      value: settings.dim,
                      min: 0,
                      max: 0.8,
                      step: 0.01,
                      display: pct(settings.dim),
                      onChange: (value) => update({ dim: value }),
                    }),
                    h(Slider, {
                      label: tr('surface'),
                      value: settings.surface,
                      min: 0.15,
                      max: 0.95,
                      step: 0.01,
                      display: pct(settings.surface),
                      onChange: (value) => update({ surface: value }),
                    }),
                    h('div', { className: 'dshbg-hint' }, tr('surfaceHint')),
                  ),
              notice ? h('div', { className: 'dshbg-notice', 'data-kind': notice.kind }, notice.text) : null,
              h(
                'div',
                { className: 'dshbg-foot' },
                h(
                  'div',
                  { className: 'dshbg-foot-left' },
                  h(
                    'button',
                    { type: 'button', className: 'dshbg-text-btn', disabled: !image || busy !== '', onClick: resetDefaults },
                    h(IconReset),
                    tr('reset'),
                  ),
                  h(
                    'span',
                    { className: 'dshbg-status', 'data-kind': saveKind },
                    saveKind === 'ok' ? h(IconCheck) : null,
                    saveText,
                  ),
                ),
                h('button', { type: 'button', className: 'dshbg-primary', onClick: closePanel }, tr('done')),
              ),
            ),
          )
        : null

      return h(
        React.Fragment,
        null,
        h('style', { 'data-dsh-background': 'true', dangerouslySetInnerHTML: { __html: CSS } }),
        h(
          'button',
          {
            type: 'button',
            className: 'dshbg-fab',
            'data-active': active ? 'true' : 'false',
            'aria-label': tr('fab'),
            title: tr('fab'),
            onClick: () => setOpen(true),
          },
          h(IconImage, { size: 18 }),
          active ? h('span', { className: 'dshbg-fab-dot', 'aria-hidden': 'true' }) : null,
        ),
        h('input', {
          ref: fileInputRef,
          type: 'file',
          accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif',
          style: { display: 'none' },
          onChange: onFileChange,
        }),
        dialog,
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const register = () => ctx.locale.register(NS, { zh: ZH, en: EN })
        if (typeof ctx.effect === 'function') ctx.effect(register, 'dsh-background: locale')
        else register()
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'dsh-background',
              order: 40,
              locale: NS,
              inject: () => ({ t }),
            },
            BackgroundPanel,
          ),
        )
      },
    }
  },
})
