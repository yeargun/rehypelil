import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import vm from "node:vm"
import * as api from "../dist/rehype.esm.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(import.meta.url)
const { rehype } = api

describe("rehype", () => {
  it("exposes the upstream public API", () => {
    assert.deepEqual(Object.keys(api), ["rehype"])
    assert.equal(typeof rehype, "function")
    assert.deepEqual(Object.keys(require("../dist/rehype.cjs")), ["rehype"])
  })

  it("processSync stringifies html", () => {
    const file = rehype().processSync("<p>hi</p>")
    const text = String(file.value ?? file.result ?? file)
    assert.match(text, /<p>/)
    assert.match(text, /hi/)
  })

  it("passes string input to the embedded parser and decodes Uint8Array input", () => {
    let input
    const processor = rehype().use(function captureParserInput() {
      const parser = this.parser
      this.parser = function (document, file) {
        input = document
        return parser(document, file)
      }
    })

    const file = processor.processSync(
      new TextEncoder().encode("<p>smörgås ✓</p>"),
    )

    assert.equal(typeof input, "string")
    assert.equal(input, "<p>smörgås ✓</p>")
    assert.match(String(file), /smörgås ✓/)
  })

  it("returns a VFile-compatible artifact", () => {
    const file = rehype().processSync({ path: "docs/index.html", value: "x" })

    assert.equal(file.cwd, process.cwd())
    assert.deepEqual(file.history, ["docs/index.html"])
    assert.equal(file.path, "docs/index.html")
    assert.equal(file.dirname, "docs")
    assert.equal(file.basename, "index.html")
    assert.equal(file.stem, "index")
    assert.equal(file.extname, ".html")
  })

  it("keeps processor methods on the shared prototype", () => {
    const processor = rehype()
    assert.equal(processor.name, "apply")
    assert.equal(processor.constructor.name, "Processor")
    assert.equal(Object.hasOwn(processor, "processSync"), false)
    assert.equal(Object.hasOwn(Object.getPrototypeOf(processor), "processSync"), true)
    assert.equal(typeof processor.copy, "function")
  })

  it("exposes and uses the same own processor state as unified", async () => {
    const { unified } = await import("unified")
    const actual = rehype()
    const expected = unified()

    assert.deepEqual(Object.keys(actual), Object.keys(expected))
    for (const key of Object.keys(expected)) {
      const descriptor = Object.getOwnPropertyDescriptor(actual, key)
      const reference = Object.getOwnPropertyDescriptor(expected, key)
      assert.equal(descriptor.enumerable, reference.enumerable, key)
      assert.equal(descriptor.configurable, reference.configurable, key)
      assert.equal(descriptor.writable, reference.writable, key)
    }

    const namespace = { alpha: "bravo" }
    actual.namespace = namespace
    assert.equal(actual.data(), namespace)
    assert.equal(actual.data("alpha"), "bravo")

    const replacement = { charlie: "delta" }
    actual.data(replacement)
    assert.equal(actual.namespace, replacement)
    assert.equal(actual.data(), replacement)
    assert.deepEqual(actual().namespace, replacement)
    assert.notEqual(actual().namespace, replacement)

    actual.freeze()
    assert.equal(actual.frozen, true)
    assert.equal(actual.freezeIndex, Number.POSITIVE_INFINITY)
  })

  it("coerces parser files with String and Symbol.toPrimitive", () => {
    let document
    const processor = rehype().use(function captureInput() {
      this.parser = function (value) {
        document = value
        return { type: "root", children: [] }
      }
    })
    const file = {
      message() {},
      messages: [],
      toString() {
        throw new Error("toString must not run")
      },
      [Symbol.toPrimitive](hint) {
        assert.equal(hint, "string")
        return "<p>primitive</p>"
      },
    }

    processor.parse(file)
    assert.equal(document, "<p>primitive</p>")
  })

  it("applies character-reference settings to text and attributes", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "div",
          properties: { title: 'a"&' },
          children: [{ type: "text", value: "<&" }],
        },
      ],
    }

    assert.equal(
      rehype()
        .data("settings", { characterReferences: { useNamedReferences: true } })
        .stringify(tree),
      '<div title="a&quot;&amp;">&lt;&amp;</div>',
    )
  })

  it("keeps pinned processor keys in the library artifact", () => {
    const src = readFileSync(resolve(root, "dist/rehype.esm.js"), "utf8")
    assert.match(src, /processSync/)
    assert.match(src, /compiler/)
    assert.match(src, /tagName/)
    assert.match(src, /type/)
    assert.doesNotMatch(
      src,
      /(?:from|import)\s*["'][^"']*parse5\/index\.js["']/,
    )
  })

  it("keeps upstream module paths and omits build intermediates", () => {
    for (const path of [
      "src/index.lil",
      "src/rehype-parse/lib/index.lil",
      "src/rehype-stringify/lib/index.lil",
      "src/unified/lib/index.lil",
      "src/parse5/parser/index.lil",
    ]) {
      assert.equal(existsSync(resolve(root, path)), true, path)
    }
    for (const path of [
      "src/entry.lil",
      "src/parse.lil",
      "src/stringify.lil",
      "src/parse5/index.js",
      "src/unified/lib/callable-instance.js",
      "dist/parse5-host.js",
      "dist/errors-host.js",
      "dist/rehype.raw.js",
    ]) {
      assert.equal(existsSync(resolve(root, path)), false, path)
    }
  })

  it("loads the UMD artifact as the rehype factory", () => {
    const context = {}
    vm.runInNewContext(readFileSync(resolve(root, "dist/rehype.umd.js"), "utf8"), context)

    assert.equal(typeof context.rehype, "function")
    assert.match(String(context.rehype().processSync("<p>umd</p>")), /umd/)
  })
})
