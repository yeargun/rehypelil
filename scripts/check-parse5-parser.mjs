import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { brotliCompressSync } from "node:zlib"
import { dirname, extname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { defaultTreeAdapter, html, parse, parseFragment } from "parse5"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const compiler = process.env.LILSCRIPT_COMPILER ?? resolve(root, "../lilscript/target/release/lilscript")
const output = resolve(root, ".tmp/parse5-parser-test.js")
const compilation = spawnSync(
  compiler,
  [
    resolve(root, "src/parse5/parser/index.lil"),
    "--target",
    "js-module",
    "--config",
    resolve(root, "test/parse5-modules.toml"),
    "-o",
    output,
  ],
  { cwd: root, encoding: "utf8" },
)

assert.equal(compilation.status, 0, compilation.stderr || compilation.stdout)
const lil = await import(`${pathToFileURL(output).href}?${Date.now()}`)

function files(directory) {
  const result = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...files(path))
    else if (path.endsWith(".dat") || path.endsWith(".test")) result.push(path)
  }
  return result.sort()
}

function inputs(path) {
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

function treeCases(path) {
  const descriptions = []
  let current
  let directive = ""
  for (const [index, line] of readFileSync(path, "utf8").split(/\r?\n/).entries()) {
    if (line === "#data") {
      current = { line: index + 1 }
      descriptions.push(current)
    }
    if (line.startsWith("#")) {
      directive = line
      current[directive] = []
    } else {
      current[directive].push(line)
    }
  }
  return descriptions.map((description) => ({
    input: description["#data"].join("\n"),
    fragment: description["#document-fragment"]?.[0],
    scriptingEnabled: !description["#script-off"],
    line: description.line,
  }))
}

function context(description) {
  if (!description) return null
  const parts = description.split(" ")
  let namespaceURI = html.NS.HTML
  let tagName = parts[0]
  if (parts.length > 1) {
    tagName = parts[1]
    if (parts[0] === "svg") namespaceURI = html.NS.SVG
    else if (parts[0] === "math") namespaceURI = html.NS.MATHML
  }
  return defaultTreeAdapter.createElement(tagName, namespaceURI, [])
}

function clean(value) {
  return JSON.parse(JSON.stringify(value, (key, child) => (key === "parentNode" ? undefined : child)))
}

function evaluate(run) {
  const errors = []
  try {
    return {
      tree: clean(run({
        sourceCodeLocationInfo: true,
        onParseError(error) {
          errors.push(error)
        },
      })),
      errors,
    }
  } catch (error) {
    return { thrown: { name: error.name, message: error.message }, errors }
  }
}

function compare(input, fragment, scriptingEnabled, label) {
  const expectedContext = context(fragment)
  const actualContext = context(fragment)
  const expected = evaluate((options) => {
    options.scriptingEnabled = scriptingEnabled
    return fragment ? parseFragment(expectedContext, input, options) : parse(input, options)
  })
  const actual = evaluate((options) => {
    options.scriptingEnabled = scriptingEnabled
    return fragment
      ? lil.parseFragmentWithContext(actualContext, input, options)
      : lil.parseDocument(input, options)
  })
  assert.deepEqual(actual, expected, `${label}\ninput=${JSON.stringify(input)}`)
  return Boolean(actual.thrown)
}

const broadRoots = [
  ".tmp/parse5/test/data/html5lib-tests/tree-construction",
  ".tmp/parse5/test/data/html5lib-tests/tokenizer",
  ".tmp/parse5/test/data/html5lib-tests-fork/tree-construction",
  ".tmp/parse5/test/data/html5lib-tests-fork/tokenizer",
  ".tmp/parse5/test/data/parser-feedback",
]

let broadParses = 0
let broadThrows = 0
for (const directory of broadRoots) {
  for (const path of files(resolve(root, directory))) {
    let index = 0
    for (const input of inputs(path)) {
      if (compare(input, null, false, `${path}:${index}:document`)) broadThrows++
      if (compare(input, "template", false, `${path}:${index}:fragment`)) broadThrows++
      broadParses += 2
      index++
    }
  }
}

let treeConstructionCases = 0
let treeConstructionThrows = 0
for (const directory of [
  ".tmp/parse5/test/data/html5lib-tests/tree-construction",
  ".tmp/parse5/test/data/html5lib-tests-fork/tree-construction",
]) {
  for (const path of files(resolve(root, directory))) {
    for (const test of treeCases(path)) {
      if (compare(test.input, test.fragment, test.scriptingEnabled, `${path}:${test.line}:tree-construction`)) treeConstructionThrows++
      treeConstructionCases++
    }
  }
}

const fragments = [
  "text", "<&notit;&#x80;", "<!--a--b-->", "<!doctype html>", "<a href='&copy'>",
  "</a>", "<b>", "</b>", "<p>", "</p>", "<table>", "<tbody><tr><td>",
  "</td></tr></tbody></table>", "<template>", "</template>", "<select><option>",
  "</select>", "<svg viewbox='0 0 1 1'><foreignobject>", "</foreignobject></svg>",
  "<math><annotation-xml encoding='text/html'>", "</annotation-xml></math>",
  "<script><!--<script>x</script>--></script>", "<textarea>&amp;</textarea>",
  "<frameset><frame></frameset>", "\r\n", "\0", "\ud800", "<", ">", "</", "<!",
]
let random = 0x5eed7300
const fuzzCases = Number(process.env.PARSE5_PARSER_FUZZ_CASES ?? 12000)
let fuzzThrows = 0
for (let index = 0; index < fuzzCases; index++) {
  random = (Math.imul(random, 1664525) + 1013904223) >>> 0
  let input = ""
  const count = 1 + (random % 24)
  for (let part = 0; part < count; part++) {
    random = (Math.imul(random, 1103515245) + 12345) >>> 0
    input += fragments[random % fragments.length]
  }
  const fragment = index % 2 === 0 ? ["template", "table", "select", "svg svg", "math math"][index % 5] : null
  if (compare(input, fragment, (index & 2) === 0, `fuzz:${index}:seed=${random}`)) fuzzThrows++
}

const callbackInputs = [
  "<p><p>",
  "<table>x<tr><td>y</table>",
  "<b><i>x</b>y</i>",
  "<template><table><tr><td>x</template>",
  "<svg><foreignObject><p>x</svg>",
]
for (const input of callbackInputs) {
  const trace = (run) => {
    const events = []
    const treeAdapter = {
      ...defaultTreeAdapter,
      onItemPush(node) {
        events.push(["push", node.tagName])
      },
      onItemPop(node, current) {
        events.push(["pop", node.tagName, current?.tagName])
      },
    }
    run({ treeAdapter })
    return events
  }
  assert.deepEqual(
    trace((options) => lil.parseDocument(input, options)),
    trace((options) => parse(input, options)),
    `callback order: ${JSON.stringify(input)}`,
  )
}

const sourceBytes = statSync(resolve(root, "src/parse5/parser/index.lil")).size
const referenceBytes = statSync(resolve(root, "node_modules/parse5/dist/parser/index.js")).size
const rawBytes = statSync(output).size
const brotliBytes = brotliCompressSync(readFileSync(output)).length
console.log(JSON.stringify({ broadParses, broadThrows, treeConstructionCases, treeConstructionThrows, fuzzCases, fuzzThrows, callbackCases: callbackInputs.length, sourceBytes, referenceBytes, rawBytes, brotliBytes }))
