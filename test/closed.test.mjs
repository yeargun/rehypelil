import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import * as api from "../dist/rehype.closed.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

describe("rehype closed", () => {
  it("ships a closed artifact with named exports", () => {
    assert.equal(existsSync(resolve(root, "dist/rehype.closed.js")), true)
    assert.deepEqual(Object.keys(api), ["rehype"])
    assert.equal(typeof api.rehype, "function")
    assert.match(String(api.rehype().processSync("<p>closed</p>")), /closed/)
  })
})
