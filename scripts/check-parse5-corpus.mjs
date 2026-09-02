import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"
import { VFile } from "vfile"
import { rehype as lilRehype } from "../dist/rehype.esm.js"

const referenceRehype = unified().use(rehypeParse).use(rehypeStringify).freeze()
const roots = process.argv.slice(2)

if (roots.length === 0) {
  roots.push(
    ".tmp/parse5/test/data/html5lib-tests/tree-construction",
    ".tmp/parse5/test/data/html5lib-tests/tokenizer",
    ".tmp/parse5/test/data/html5lib-tests-fork/tree-construction",
    ".tmp/parse5/test/data/html5lib-tests-fork/tokenizer",
    ".tmp/parse5/test/data/parser-feedback",
  )
}

function files(directory) {
  const result = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...files(path))
    else if (path.endsWith(".dat") || path.endsWith(".test")) result.push(path)
  }
  return result
}

function cases(path) {
  const source = readFileSync(path, "utf8")
  if (path.endsWith(".test")) {
    const json = JSON.parse(source)
    return (json.tests ?? json.xmlViolationTests).flatMap((test) => {
      const input = test.doubleEscaped
        ? test.input.replaceAll(/\\u([\da-f]{4})/gi, (_, hex) =>
            String.fromCharCode(Number.parseInt(hex, 16)),
          )
        : test.input
      return (test.initialStates ?? ["Data state"]).map((state) => {
        if (state === "RCDATA state") return `<title>${input}</title>`
        if (state === "RAWTEXT state") return `<style>${input}</style>`
        if (state === "Script data state") return `<script>${input}</script>`
        if (state === "PLAINTEXT state") return `<plaintext>${input}`
        if (state === "CDATA section state") return `<svg><![CDATA[${input}]]></svg>`
        return input
      })
    })
  }

  const result = []
  const pattern = /(?:^|\n)#data\n([\s\S]*?)\n#errors(?:\n|$)/g
  let match
  while ((match = pattern.exec(source))) result.push(match[1])
  return result
}

function evaluate(factory, input, fragment) {
  try {
    const processor = factory().data("settings", {
      emitParseErrors: true,
      fragment,
      verbose: true,
    })
    const file = new VFile({ path: "corpus.html", value: input })
    const tree = processor.parse(file)
    const output = processor.stringify(tree, file)
    return JSON.parse(JSON.stringify({ tree, output, messages: file.messages }))
  } catch (error) {
    return { thrown: { name: error.name, message: error.message } }
  }
}

let checked = 0
let matchedThrows = 0
for (const root of roots) {
  for (const path of files(resolve(root))) {
    let index = 0
    for (const input of cases(path)) {
      for (const fragment of [false, true]) {
        const label = `${path}:${index} (${fragment ? "fragment" : "document"})`
        try {
          const actual = evaluate(lilRehype, input, fragment)
          const expected = evaluate(referenceRehype, input, fragment)
          assert.deepEqual(
            actual,
            expected,
            label,
          )
          if (actual.thrown) matchedThrows++
        } catch (error) {
          throw new Error(`${label}\ninput: ${JSON.stringify(input)}`, {
            cause: error,
          })
        }
        checked++
      }
      index++
    }
  }
}

console.log(
  `parse5 differential corpus: ${checked} document/fragment parses, ${matchedThrows} matching upstream throws`,
)
