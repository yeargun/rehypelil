import {
  accessSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { build as esbuild } from "esbuild"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const lilscriptRoot = process.env.LILSCRIPT_ROOT ?? resolve(root, "..", "lilscript")
const dist = resolve(root, "dist")
const file = "rehype"
const banner = "/*! @itslil/rehype 13.0.3 | LilScript reimplementation of rehype | MIT */\n"

function compilerPath() {
  const candidates = [
    process.env.LILSCRIPT_COMPILER,
    resolve(lilscriptRoot, "target", "release", "lilscript"),
    resolve(lilscriptRoot, "target", "debug", "lilscript"),
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK)
    } catch {
      continue
    }
    return candidate
  }
  return null
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function compileLil(compiler, configName, outputName) {
  run(compiler, [
    resolve(root, "src", "entry.lil"),
    "--target",
    "js-module",
    "--config",
    resolve(root, configName),
    "-o",
    resolve(dist, outputName),
  ])
}

async function bundleParse5Host() {
  await esbuild({
    absWorkingDir: root,
    entryPoints: [resolve(root, "src", "parse5-host.js")],
    outfile: resolve(dist, "parse5-host.js"),
    bundle: true,
    format: "esm",
    platform: "neutral",
    legalComments: "none",
    minifyWhitespace: false,
    minifyIdentifiers: false,
    minifySyntax: false,
    logLevel: "error",
  })
  copyFileSync(resolve(root, "src", "errors-host.js"), resolve(dist, "errors-host.js"))
}

async function bundleCompiled(entryName, outfile, format, extra) {
  await esbuild({
    absWorkingDir: dist,
    entryPoints: [resolve(dist, entryName)],
    outfile,
    bundle: true,
    format,
    platform: "neutral",
    legalComments: "none",
    minifyWhitespace: format != "esm",
    minifyIdentifiers: false,
    minifySyntax: false,
    banner: { js: banner },
    logLevel: "error",
    ...extra,
  })
}

async function compileIfRequested() {
  if (!process.argv.includes("--compile") && existsSync(resolve(dist, `${file}.raw.js`))) {
    return
  }
  const compiler = compilerPath()
  if (!compiler) {
    throw new Error("LilScript compiler not found. Set LILSCRIPT_COMPILER or build lilscript.")
  }
  mkdirSync(dist, { recursive: true })
  await bundleParse5Host()
  compileLil(compiler, "lilscript.toml", `${file}.raw.js`)
  compileLil(compiler, "lilscript.closed.toml", `${file}.closed.js`)
}

await compileIfRequested()
mkdirSync(dist, { recursive: true })

const rawPath = resolve(dist, `${file}.raw.js`)
if (!existsSync(rawPath)) {
  throw new Error(`dist/${file}.raw.js is missing. Run with --compile after building LilScript.`)
}

if (!existsSync(resolve(dist, "parse5-host.js"))) {
  await bundleParse5Host()
}

await bundleCompiled(`${file}.raw.js`, resolve(dist, `${file}.esm.js`), "esm")

const closedPath = resolve(dist, `${file}.closed.js`)
if (existsSync(closedPath) && readFileSync(closedPath, "utf8").includes("parse5-host.js")) {
  const closedBundled = resolve(dist, `${file}.closed.bundled.js`)
  await bundleCompiled(`${file}.closed.js`, closedBundled, "esm", { banner: undefined })
  writeFileSync(closedPath, `${banner}${readFileSync(closedBundled, "utf8").trimEnd()}\n`)
  try {
    unlinkSync(closedBundled)
  } catch {}
}

await bundleCompiled(`${file}.esm.js`, resolve(dist, `${file}.cjs`), "cjs")

await esbuild({
  absWorkingDir: dist,
  entryPoints: [resolve(dist, `${file}.esm.js`)],
  outfile: resolve(dist, `${file}.umd.js`),
  bundle: true,
  format: "iife",
  globalName: "rehype",
  footer: {
    js: `globalThis.rehype=rehype.default||rehype.rehype||rehype;`,
  },
  legalComments: "none",
  minifyWhitespace: true,
  minifyIdentifiers: false,
  minifySyntax: false,
  banner: { js: banner },
  logLevel: "error",
})

copyFileSync(resolve(root, "types", `${file}.d.ts`), resolve(dist, `${file}.d.ts`))
console.log(`wrote dist/${file}.esm.js, dist/${file}.cjs, dist/${file}.umd.js, dist/${file}.closed.js`)
