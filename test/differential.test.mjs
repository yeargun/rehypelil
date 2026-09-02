import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"
import { VFile } from "vfile"
import { rehype as lilRehype } from "../dist/rehype.esm.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "official")
const referenceRehype = unified().use(rehypeParse).use(rehypeStringify).freeze()

function evaluate(factory, input, settings) {
  const processor = factory().data("settings", settings)
  const file = new VFile({ path: "corpus.html", value: input })
  const tree = processor.parse(file)
  const output = processor.stringify(tree, file)

  return JSON.parse(JSON.stringify({ tree, output, messages: file.messages }))
}

function compare(input, settings = {}) {
  assert.deepEqual(
    evaluate(lilRehype, input, settings),
    evaluate(referenceRehype, input, settings),
    JSON.stringify({ input, settings }),
  )
}

function fixtureInputs(directory) {
  const inputs = []
  for (const name of readdirSync(directory)) {
    const path = join(directory, name, "index.html")
    inputs.push(readFileSync(path, "utf8"))
  }
  return inputs
}

function random(seed) {
  let state = seed >>> 0
  return function next(limit) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state % limit
  }
}

const tokens = [
  "text",
  "<&notit;&#x80;",
  "<!--a--b-->",
  "<!doctype html>",
  "<a href='&copy'>",
  "</a>",
  "<b>",
  "</b>",
  "<p>",
  "</p>",
  "<table>",
  "<tbody><tr><td>",
  "</td></tr></tbody></table>",
  "<template>",
  "</template>",
  "<select><option>",
  "</select>",
  "<svg viewbox='0 0 1 1'><foreignobject>",
  "</foreignobject></svg>",
  "<math><annotation-xml encoding='text/html'>",
  "</annotation-xml></math>",
  "<script><!--<script>x</script>--></script>",
  "<textarea>&amp;</textarea>",
  "<frameset><frame></frameset>",
  "\r\n",
  "\0",
  "\ud800",
]

describe("parse5 differential", () => {
  it("matches malformed selectors and case-sensitive SVG tag names", () => {
    compare("<a.>", { emitParseErrors: true, verbose: true })
    compare("<svg><solidColor/><textArea/><feDropShadow/></svg>", {
      emitParseErrors: true,
      verbose: true,
    })
  })

  it("matches the installed upstream graph on every rehype fixture", () => {
    for (const input of fixtureInputs(join(root, "fixtures"))) {
      compare(input, { emitParseErrors: true })
      compare(input, { emitParseErrors: true, fragment: true, verbose: true })
    }
  })

  it("matches the installed upstream graph on every parse-error fixture", () => {
    for (const input of fixtureInputs(join(root, "parse-error"))) {
      compare(input, { emitParseErrors: true })
    }
  })

  it("matches deterministic malformed HTML fuzz cases", () => {
    const next = random(0x5eed_7300)
    for (let caseIndex = 0; caseIndex < 512; caseIndex++) {
      let input = ""
      const length = 1 + next(16)
      for (let index = 0; index < length; index++) {
        input += tokens[next(tokens.length)]
      }
      compare(input, {
        emitParseErrors: true,
        fragment: caseIndex % 2 === 0,
        verbose: caseIndex % 7 === 0,
      })
    }
  })
})
