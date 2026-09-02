import {
  accessSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { build as esbuild } from "esbuild"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const lilscriptRoot = process.env.LILSCRIPT_ROOT ?? resolve(root, "..", "lilscript")
const dist = resolve(root, "dist")
const temporary = resolve(root, ".tmp", "build")
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

function compileLil(compiler, configName, outputPath) {
  run(compiler, [
    resolve(root, "src", "index.lil"),
    "--target",
    "js-module",
    "--config",
    resolve(root, configName),
    "-o",
    outputPath,
  ])
}

async function bundleCompiled(entryPath, outfile, format, extra) {
  await esbuild({
    absWorkingDir: root,
    entryPoints: [entryPath],
    outfile,
    bundle: true,
    format,
    platform: "neutral",
    legalComments: "none",
    // esbuild escapes every non-ASCII character to `\uXXXX` unless told otherwise:
    // six ASCII bytes where the literal is two or three UTF-8 ones. This artifact
    // carries over six thousand of them.
    charset: "utf8",
    minifyWhitespace: true,
    minifyIdentifiers: false,
    minifySyntax: false,
    banner: { js: banner },
    logLevel: "error",
    ...extra,
  })
}

async function compileIfRequested() {
  if (!process.argv.includes("--compile") && existsSync(resolve(dist, `${file}.esm.js`))) {
    return false
  }
  const compiler = compilerPath()
  if (!compiler) {
    throw new Error("LilScript compiler not found. Set LILSCRIPT_COMPILER or build lilscript.")
  }
  mkdirSync(dist, { recursive: true })
  mkdirSync(temporary, { recursive: true })
  rmSync(resolve(dist, `${file}.raw.js`), { force: true })
  rmSync(resolve(dist, "parse5-host.js"), { force: true })
  rmSync(resolve(dist, "errors-host.js"), { force: true })
  compileLil(compiler, "lilscript.toml", resolve(temporary, `${file}.raw.js`))
  compileLil(compiler, "lilscript.closed.toml", resolve(temporary, `${file}.closed.raw.js`))
  return true
}

const compiled = await compileIfRequested()
mkdirSync(dist, { recursive: true })

if (compiled) {
  await bundleCompiled(
    resolve(temporary, `${file}.raw.js`),
    resolve(dist, `${file}.esm.js`),
    "esm",
  )
  await bundleCompiled(
    resolve(temporary, `${file}.closed.raw.js`),
    resolve(dist, `${file}.closed.js`),
    "esm",
  )
  rmSync(temporary, { recursive: true, force: true })
}

await bundleCompiled(
  resolve(dist, `${file}.esm.js`),
  resolve(dist, `${file}.cjs`),
  "cjs",
)

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
  // esbuild escapes every non-ASCII character to `\uXXXX` unless told otherwise:
  // six ASCII bytes where the literal is two or three UTF-8 ones. This artifact
  // carries 6327 of them.
  charset: "utf8",
  minifyWhitespace: true,
  minifyIdentifiers: false,
  minifySyntax: false,
  banner: { js: banner },
  logLevel: "error",
})

copyFileSync(resolve(root, "types", `${file}.d.ts`), resolve(dist, `${file}.d.ts`))
console.log(`wrote dist/${file}.esm.js, dist/${file}.cjs, dist/${file}.umd.js, dist/${file}.closed.js`)
