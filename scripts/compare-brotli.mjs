import { readFileSync } from "node:fs"
import { brotliCompressSync, constants, gzipSync } from "node:zlib"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import { minify } from "terser"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const upstreamRoot = resolve(
  process.env.REHYPE_UPSTREAM_ROOT ?? "/tmp/opencode/markdown-upstreams/rehype",
)
const banner = "/*! @itslil/rehype 13.0.3 | LilScript reimplementation of rehype | MIT */\n"

function size(source) {
  const bytes = Buffer.isBuffer(source) ? source : Buffer.from(source)
  return {
    raw: bytes.length,
    gzip9: gzipSync(bytes, { level: 9 }).length,
    brotli11: brotliCompressSync(bytes, {
      params: {
        [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
        [constants.BROTLI_PARAM_QUALITY]: 11,
        [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
      },
    }).length,
  }
}

const official = await build({
  absWorkingDir: upstreamRoot,
  entryPoints: [resolve(upstreamRoot, "packages", "rehype", "index.js")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  legalComments: "none",
  minifyWhitespace: false,
  minifyIdentifiers: false,
  minifySyntax: true,
  banner: { js: banner },
  write: false,
})

const officialSource = official.outputFiles[0].text
const officialEsbuild = await build({
  absWorkingDir: upstreamRoot,
  entryPoints: [resolve(upstreamRoot, "packages", "rehype", "index.js")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  legalComments: "none",
  minify: true,
  banner: { js: banner },
  write: false,
})
const terserMangle = await minify(officialSource, {
  compress: true,
  ecma: 2022,
  format: { comments: /^!/ },
  mangle: true,
  module: true,
})
const terserNoMangle = await minify(officialSource, {
  compress: true,
  ecma: 2022,
  format: { comments: /^!/ },
  mangle: false,
  module: true,
})

if (!terserMangle.code || !terserNoMangle.code) {
  throw new Error("Terser did not produce the official baseline")
}

const measurements = {
  official: size(official.outputFiles[0].contents),
  officialTerserMangle: size(terserMangle.code),
  officialTerserNoMangle: size(terserNoMangle.code),
  officialEsbuild: size(officialEsbuild.outputFiles[0].contents),
  lilscript: size(readFileSync(resolve(root, "dist", "rehype.esm.js"))),
  lilscriptClosed: size(readFileSync(resolve(root, "dist", "rehype.closed.js"))),
}

console.log(JSON.stringify(measurements, undefined, 2))
