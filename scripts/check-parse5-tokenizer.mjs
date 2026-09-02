import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { brotliCompressSync } from "node:zlib"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, extname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { Tokenizer } from "../node_modules/parse5/dist/tokenizer/index.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const compiler = process.env.LILSCRIPT_COMPILER ?? resolve(root, "../lilscript/target/release/lilscript")
const corpus = process.env.PARSE5_TOKENIZER_CORPUS ?? resolve(root, ".tmp/parse5/test/data/html5lib-tests/tokenizer")
const output = resolve(root, ".tmp/parse5-tokenizer-test.js")
const sizeOutput = resolve(root, ".tmp/parse5-tokenizer-size.js")
const compilation = spawnSync(
  compiler,
  [
    resolve(root, "test/parse5-tokenizer.lil"),
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

const modes = {
  "Data state": 0,
  "RCDATA state": 1,
  "RAWTEXT state": 2,
  "Script data state": 3,
  "PLAINTEXT state": 4,
  "CDATA section state": 68,
}
let matchingThrows = 0

function traceOfficial(chunks, mode, lastStartTag, inForeignNode, locations) {
  const tokens = []
  const errors = []
  const events = []
  const add = (kind, token) => {
    tokens.push(token)
    events.push({ kind, value: token })
  }
  const handler = {
    onComment: (token) => add("comment", token),
    onDoctype: (token) => add("doctype", token),
    onStartTag: (token) => add("startTag", token),
    onEndTag: (token) => add("endTag", token),
    onEof: (token) => add("eof", token),
    onCharacter: (token) => add("character", token),
    onNullCharacter: (token) => add("null", token),
    onWhitespaceCharacter: (token) => add("whitespace", token),
    onParseError(error) {
      errors.push(error)
      events.push({ kind: "error", value: error })
    },
  }
  const tokenizer = new Tokenizer({ sourceCodeLocationInfo: locations }, handler)
  tokenizer.preprocessor.bufferWaterline = 8
  tokenizer.state = mode
  tokenizer.lastStartTagName = lastStartTag
  tokenizer.inForeignNode = inForeignNode
  for (let index = 0; index < chunks.length; index++) {
    tokenizer.write(chunks[index], index === chunks.length - 1, () => {
      events.push({ kind: "write", value: index })
    })
  }
  return {
    tokens,
    errors,
    events,
    active: tokenizer.active,
    state: tokenizer.state,
    line: tokenizer.preprocessor.line,
    col: tokenizer.preprocessor.col,
    offset: tokenizer.preprocessor.offset,
  }
}

function deterministicChunks(input, salt) {
  if (input.length === 0) return [""]
  const chunks = []
  let offset = 0
  let state = salt >>> 0
  while (offset < input.length) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const end = Math.min(input.length, offset + 1 + (state % 11))
    chunks.push(input.slice(offset, end))
    offset = end
  }
  return chunks
}

function unicodeUnescape(value) {
  return value.replace(/\\[Uu]\w{4}/g, (match) => String.fromCharCode(Number.parseInt(match.slice(2), 16)))
}

function compare(chunks, mode, lastStartTag, inForeignNode, locations, label) {
  try {
    let expected
    let actual
    let expectedError
    let actualError
    try {
      expected = traceOfficial(chunks, mode, lastStartTag, inForeignNode, locations)
    } catch (error) {
      expectedError = error
    }
    try {
      actual = lil.tokenizerTrace(chunks, mode, lastStartTag, inForeignNode, locations)
    } catch (error) {
      actualError = error
    }
    if (expectedError || actualError) {
      assert.equal(actualError?.constructor?.name, expectedError?.constructor?.name, "thrown error type")
      assert.equal(actualError?.message, expectedError?.message, "thrown error message")
      matchingThrows++
      return
    }
    assert.deepEqual(actual, expected, `${label}\nchunks=${JSON.stringify(chunks)}`)
  } catch (error) {
    error.message = `${label}\nchunks=${JSON.stringify(chunks)}\n${error.message}`
    throw error
  }
}

function controlTrace() {
  const events = []
  let tokenizer
  const noop = () => {}
  tokenizer = new Tokenizer({ sourceCodeLocationInfo: true }, {
    onComment() { events.push("comment"); tokenizer.pause() },
    onDoctype() { events.push("doctype") },
    onStartTag(token) { events.push(`start:${token.tagName}`) },
    onEndTag(token) { events.push(`end:${token.tagName}`) },
    onEof() { events.push("eof") },
    onCharacter() { events.push("character") },
    onNullCharacter() { events.push("null") },
    onWhitespaceCharacter() { events.push("whitespace") },
    onParseError: noop,
  })
  tokenizer.write("<!--x-->", false, () => events.push("first-write"))
  events.push("after-paused-write")
  tokenizer.resume(() => events.push("resume"))
  tokenizer.write("<a>", true, () => events.push("second-write"))
  return events
}

function insertionTrace() {
  const events = []
  let tokenizer
  const noop = () => {}
  tokenizer = new Tokenizer({ sourceCodeLocationInfo: true }, {
    onComment() { events.push("comment"); tokenizer.insertHtmlAtCurrentPos("<b>") },
    onDoctype() { events.push("doctype") },
    onStartTag(token) { events.push(`start:${token.tagName}`) },
    onEndTag(token) { events.push(`end:${token.tagName}`) },
    onEof() { events.push("eof") },
    onCharacter() { events.push("character") },
    onNullCharacter() { events.push("null") },
    onWhitespaceCharacter() { events.push("whitespace") },
    onParseError: noop,
  })
  tokenizer.write("<!--x--><a>", true, () => events.push("write"))
  return events
}

assert.deepEqual(lil.tokenizerControlTrace(), controlTrace(), "pause/resume and write callback ordering")
assert.deepEqual(lil.tokenizerInsertionTrace(), insertionTrace(), "synchronous insertion ordering")

let corpusCases = 0
let corpusExecutions = 0
for (const fileName of readdirSync(corpus).sort()) {
  if (extname(fileName) !== ".test") continue
  const suite = JSON.parse(readFileSync(resolve(corpus, fileName), "utf8"))
  for (let index = 0; index < (suite.tests ?? []).length; index++) {
    const test = suite.tests[index]
    let input = test.input
    if (test.doubleEscaped) input = unicodeUnescape(input)
    for (const stateName of test.initialStates ?? ["Data state"]) {
      const mode = modes[stateName]
      assert.notEqual(mode, undefined, `unknown tokenizer state ${stateName}`)
      const label = `${fileName}:${index + 1}:${stateName}:${test.description}`
      compare(deterministicChunks(input, corpusCases + 0x730), mode, test.lastStartTag ?? "", false, true, `${label}:chunked-a`)
      compare(deterministicChunks(input, corpusCases + 0x5730), mode, test.lastStartTag ?? "", false, true, `${label}:chunked-b`)
      corpusCases++
      corpusExecutions += 2
    }
  }
}

const fragments = [
  "<", ">", "</", "<!", "<!--", "-->", "<!DOCTYPE", " PUBLIC ", " SYSTEM ",
  "<![CDATA[", "]]>", "&", "&amp", "&#", "&#x", ";", "=", "'", "\"", "/",
  "script", "ScRiPt", "</script", "<script", "\0", "\r", "\n", "\t", "\f",
  "\ud800", "\udc00", "\ud83d\ude00", "\ufdd0", "\ufffe", "abc", "123", " ",
]
let random = 0x73c0ffee
const fuzzCases = Number(process.env.PARSE5_TOKENIZER_FUZZ_CASES ?? 12000)
for (let index = 0; index < fuzzCases; index++) {
  random = (Math.imul(random, 1103515245) + 12345) >>> 0
  const parts = 1 + (random % 18)
  let input = ""
  for (let part = 0; part < parts; part++) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0
    input += fragments[random % fragments.length]
  }
  const modeChoices = [0, 1, 2, 3, 4, 68]
  const mode = modeChoices[(random >>> 8) % modeChoices.length]
  const lastStartTag = mode === 1 ? "title" : mode === 2 ? "style" : mode === 3 ? "script" : ""
  const inForeignNode = ((random >>> 16) & 1) === 1
  const locations = (index & 3) !== 0
  const chunks = deterministicChunks(input, random ^ index)
  compare(chunks, mode, lastStartTag, inForeignNode, locations, `fuzz:${index}:seed=${random}`)
}

const sizeCompilation = spawnSync(
  compiler,
  [
    resolve(root, "test/parse5-tokenizer-size.lil"),
    "--target",
    "js-module",
    "--config",
    resolve(root, "lilscript.toml"),
    "-o",
    sizeOutput,
  ],
  { cwd: root, encoding: "utf8" },
)
assert.equal(sizeCompilation.status, 0, sizeCompilation.stderr || sizeCompilation.stdout)
const rawBytes = statSync(sizeOutput).size
const brotliBytes = brotliCompressSync(readFileSync(sizeOutput)).length
const sourceBytes = statSync(resolve(root, "src/parse5/tokenizer/index.lil")).size
const referenceBytes = statSync(resolve(root, "node_modules/parse5/dist/tokenizer/index.js")).size
console.log(JSON.stringify({ corpusCases, corpusExecutions, fuzzCases, matchingThrows, sourceBytes, referenceBytes, rawBytes, brotliBytes }))
