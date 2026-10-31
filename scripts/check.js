#!/usr/bin/env node
/**
 * U惠记录 · 仓库自检脚本（零依赖）
 * ------------------------------------------------------------------
 * 本地直接跑：node scripts/check.js
 * CI 里也跑这一份（.github/workflows/ci.yml），保证「本地能过 = CI 能过」
 *
 * 检查项：
 *   1. 所有 .json 语法合法
 *   2. 所有 .js 语法合法（等价 node --check）
 *   3. 源码文件不得带 UTF-8 BOM（开发者工具会把 BOM 渲染成乱码方块）
 *   4. app.json 声明的页面：四个文件齐全，且 tabBar 页面必须在 pages 里
 *   5. 页面/组件 json 里的 usingComponents 路径必须指向真实存在的组件
 *   6. project.config.json 的 appid 必须是占位值 touristappid（防止把真实 AppID 提交上来）
 *   7. 全仓库不得出现真实 AppID（wx + 16 位十六进制）与 Windows 绝对路径
 */

const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..')
const SKIP_DIRS = new Set(['node_modules', 'miniprogram_npm', 'dist', '.git', 'shots'])
// 本地私有文件：不属于仓库内容，跳过隐私扫描
const LOCAL_ONLY = new Set(['project.private.config.json'])
const BOM = Buffer.from([0xef, 0xbb, 0xbf])

const errors = []
const warnings = []
const counts = { json: 0, js: 0, wxml: 0, wxss: 0 }

function fail(file, message) {
  errors.push(`${rel(file)}: ${message}`)
}

function warn(file, message) {
  warnings.push(`${rel(file)}: ${message}`)
}

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/')
}

/** 递归列出仓库内所有文件 */
function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue
    const abs = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(abs, out)
    else out.push(abs)
  }
  return out
}

/** 1 + 3：JSON 合法性、BOM */
function checkJson(files) {
  for (const file of files) {
    const buf = fs.readFileSync(file)
    if (buf.subarray(0, 3).equals(BOM)) fail(file, '文件开头带 UTF-8 BOM，请去掉（会导致渲染乱码）')
    const text = buf.toString('utf8')
    if (!text.trim()) {
      fail(file, '空文件，不是合法 JSON')
      continue
    }
    try {
      JSON.parse(text)
      counts.json++
    } catch (e) {
      fail(file, `JSON 解析失败：${e.message}`)
    }
  }
}

/** 2：JS 语法（用 vm 编译，等价 node --check，且不依赖子进程） */
function checkJs(files) {
  for (const file of files) {
    const buf = fs.readFileSync(file)
    if (buf.subarray(0, 3).equals(BOM)) fail(file, '文件开头带 UTF-8 BOM，请去掉')
    // 去掉 shebang 行，vm 不认识
    const code = buf.toString('utf8').replace(/^#![^\n]*\n/, '\n')
    try {
      new vm.Script(code, { filename: file })
      counts.js++
    } catch (e) {
      fail(file, `JS 语法错误：${e.message}`)
    }
  }
}

/** 3：wxml / wxss 的 BOM 与空文件 */
function checkTemplates(files) {
  for (const file of files) {
    const buf = fs.readFileSync(file)
    if (buf.subarray(0, 3).equals(BOM)) fail(file, '文件开头带 UTF-8 BOM，请去掉')
    if (!buf.toString('utf8').trim()) fail(file, '空文件')
    if (file.endsWith('.wxml')) counts.wxml++
    else counts.wxss++
  }
}

/** 4：app.json 页面与 tabBar */
function checkApp(jsonMap) {
  const appPath = path.join(ROOT, 'app.json')
  const app = jsonMap.get(appPath)
  if (!app) {
    errors.push('app.json 缺失')
    return
  }
  if (!Array.isArray(app.pages) || !app.pages.length) errors.push('app.json: pages 为空')

  for (const page of app.pages || []) {
    for (const ext of ['.js', '.json', '.wxml', '.wxss']) {
      const file = path.join(ROOT, page + ext)
      if (!fs.existsSync(file)) fail(file, `app.json 声明了页面 ${page}，但缺少 ${ext} 文件`)
    }
  }

  const tabs = (app.tabBar && app.tabBar.list) || []
  for (const item of tabs) {
    if (!(app.pages || []).includes(item.pagePath)) {
      errors.push(`app.json: tabBar 的 ${item.pagePath} 不在 pages 列表中`)
    }
    if (item.iconPath && !fs.existsSync(path.join(ROOT, item.iconPath))) {
      errors.push(`app.json: tabBar 图标不存在 ${item.iconPath}`)
    }
  }
}

/** 5：usingComponents 指向的组件必须存在 */
function checkComponents(files, jsonMap) {
  for (const file of files) {
    if (!file.endsWith('.json') || file === path.join(ROOT, 'app.json')) continue
    const json = jsonMap.get(file)
    const using = json && json.usingComponents
    if (!using || typeof using !== 'object') continue
    for (const [name, target] of Object.entries(using)) {
      if (/^plugin:\/\//.test(target)) continue
      const base = target.startsWith('/')
        ? path.join(ROOT, target)
        : path.resolve(path.dirname(file), target)
      if (!fs.existsSync(base + '.js') || !fs.existsSync(base + '.wxml')) {
        fail(file, `usingComponents 里的 "${name}" 指向 ${target}，但组件文件不存在`)
      }
    }
  }
}

/** 6 + 7：隐私红线（真实 AppID / 绝对路径） */
function checkPrivacy(jsonMap) {
  const cfgPath = path.join(ROOT, 'project.config.json')
  if (!fs.existsSync(cfgPath)) {
    errors.push('project.config.json 缺失')
  } else {
    const cfg = jsonMap.get(cfgPath)
    // 解析失败已由 checkJson 报过，这里不再重复
    if (cfg && cfg.appid !== 'touristappid') {
      fail(cfgPath, `appid 应为占位值 "touristappid"，当前是 "${cfg.appid}" —— 真实 AppID 请放进 project.private.config.json（已被 .gitignore 忽略）`)
    }
  }
  if (fs.existsSync(path.join(ROOT, 'project.private.config.json'))) {
    warnings.push('本地存在 project.private.config.json（含个人 AppID），它已在 .gitignore 中，注意不要强推')
  }
}

function checkNoSecrets(files) {
  const appIdRx = /\bwx[0-9a-f]{16}\b/g
  const winPathRx = /(?:^|[\s"'(=])[A-Za-z]:[\\/]/
  for (const file of files) {
    if (LOCAL_ONLY.has(path.basename(file))) continue
    if (!/\.(js|json|wxml|wxss|md|yml|yaml)$/.test(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    const hits = text.match(appIdRx)
    if (hits) {
      const uniq = [...new Set(hits)]
      fail(file, `出现疑似真实 AppID：${uniq.join(', ')}（AppID 请只放在本地 project.private.config.json）`)
    }
    if (winPathRx.test(text)) {
      fail(file, '出现 Windows 绝对路径（盘符 + 反斜杠），请改成相对路径或占位写法')
    }
  }
}

function main() {
  const files = walk(ROOT)
  const byExt = (ext) => files.filter((f) => f.endsWith(ext))

  const jsonFiles = byExt('.json')
  checkJson(jsonFiles)
  checkJs(byExt('.js'))
  checkTemplates(files.filter((f) => f.endsWith('.wxml') || f.endsWith('.wxss')))

  const jsonMap = new Map()
  for (const file of jsonFiles) {
    try {
      jsonMap.set(file, JSON.parse(fs.readFileSync(file, 'utf8')))
    } catch (e) {
      /* 语法错误已在 checkJson 记录 */
    }
  }

  checkApp(jsonMap)
  checkComponents(jsonFiles, jsonMap)
  checkPrivacy(jsonMap)
  checkNoSecrets(files)

  // 汇总输出
  console.log(`扫描文件：${files.length} 个（json ${counts.json} / js ${counts.js} / wxml ${counts.wxml} / wxss ${counts.wxss}）`)
  for (const w of warnings) console.log(`⚠️  ${w}`)
  if (errors.length) {
    console.log('')
    for (const e of errors) console.log(`❌ ${e}`)
    console.log(`\n自检未通过：${errors.length} 个问题`)
    process.exit(1)
  }
  console.log('✅ 自检通过')
}

main()
