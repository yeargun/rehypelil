import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import rehype, { rehype as named } from "../dist/rehype.esm.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

describe("rehype", () => {
  it("exports a factory as default and named", () => {
    assert.equal(typeof rehype, "function")
    assert.equal(named, rehype)
  })

  it("processSync stringifies html", () => {
    const file = rehype().processSync("<p>hi</p>")
    const text = String(file.value ?? file.result ?? file)
    assert.match(text, /<p>/)
    assert.match(text, /hi/)
  })

  it("processSync accepts a hast tree", () => {
    const file = rehype().processSync({
      type: "root",
      children: [
        {
          type: "element",
          tagName: "p",
          properties: {},
          children: [{ type: "text", value: "tree" }],
        },
      ],
    })
    assert.match(String(file.value ?? file.result ?? ""), /<p>/)
    assert.match(String(file.value ?? file.result ?? ""), /tree/)
  })

  it("keeps pinned processor keys in the library artifact", () => {
    const src = readFileSync(resolve(root, "dist/rehype.esm.js"), "utf8")
    assert.match(src, /processSync/)
    assert.match(src, /compiler/)
    assert.match(src, /tagName/)
    assert.match(src, /type/)
  })
})
