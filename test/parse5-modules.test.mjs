import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { describe, it } from "node:test"
import { getDocumentMode, isConforming } from "../node_modules/parse5/dist/common/doctype.js"
import * as foreignContent from "../node_modules/parse5/dist/common/foreign-content.js"
import * as html from "../node_modules/parse5/dist/common/html.js"
import * as unicode from "../node_modules/parse5/dist/common/unicode.js"
import { ERR } from "../node_modules/parse5/dist/common/error-codes.js"
import { Preprocessor } from "../node_modules/parse5/dist/tokenizer/preprocessor.js"
import { defaultTreeAdapter } from "../node_modules/parse5/dist/tree-adapters/default.js"
import { FormattingElementList } from "../node_modules/parse5/dist/parser/formatting-element-list.js"
import { OpenElementStack } from "../node_modules/parse5/dist/parser/open-element-stack.js"
import { decodeCodePoint, replaceCodePoint } from "../node_modules/entities/dist/esm/decode-codepoint.js"
import {
  DecodingMode,
  EntityDecoder,
  decodeHTML,
  decodeHTMLAttribute,
  decodeHTMLStrict,
  decodeXML,
  htmlDecodeTree,
} from "../node_modules/entities/dist/esm/decode.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const output = resolve(root, ".tmp/parse5-modules-test.js")
const compiler = process.env.LILSCRIPT_COMPILER ?? resolve(root, "../lilscript/target/release/lilscript")
const compilerConfig = process.env.PARSE5_MODULES_CONFIG ?? resolve(root, "test/parse5-modules.toml")
const compilation = spawnSync(
  compiler,
  [
    resolve(root, "test/parse5-modules.lil"),
    "--target",
    "js-module",
    "--config",
    compilerConfig,
    "-o",
    output,
  ],
  { cwd: root, encoding: "utf8" },
)

assert.equal(compilation.status, 0, compilation.stderr || compilation.stdout)
const lil = await import(`${pathToFileURL(output).href}?${Date.now()}`)

const tagNames = Object.values(html.TAG_NAMES)
const namespaceIndexes = new Map([
  [html.NS.HTML, 0],
  [html.NS.MATHML, 1],
  [html.NS.SVG, 2],
  [html.NS.XLINK, 3],
  [html.NS.XML, 4],
  [html.NS.XMLNS, 5],
])

describe("isolated parse5 LilScript modules", () => {
  it("matches all parse-error codes and reverse attribute lookup", () => {
    assert.deepEqual(lil.errorCodes(), Object.values(ERR))
    assert.equal(lil.tokenAttribute("id", "first", "id", "last", "id"), "last")
    assert.equal(lil.tokenAttribute("id", "first", "class", "last", "title"), null)
  })

  it("matches HTML tag IDs and element sets", () => {
    for (const name of tagNames) {
      assert.equal(lil.tagId(name), html.getTagID(name), name)
      assert.equal(lil.numberedHeader(name), html.NUMBERED_HEADERS.has(html.getTagID(name)), name)
      for (const [namespace, index] of namespaceIndexes) {
        assert.equal(
          lil.specialElement(index, name),
          html.SPECIAL_ELEMENTS[namespace].has(html.getTagID(name)),
          `${namespace}:${name}`,
        )
      }
    }
    for (const name of ["", "A", "foreignobject", "unknown", "x-custom"]) {
      assert.equal(lil.tagId(name), html.getTagID(name), name)
    }
    for (const name of ["style", "script", "xmp", "iframe", "noembed", "noframes", "plaintext", "noscript", "div"]) {
      assert.equal(lil.unescapedText(name, false), html.hasUnescapedText(name, false), name)
      assert.equal(lil.unescapedText(name, true), html.hasUnescapedText(name, true), name)
    }
  })

  it("matches doctype conformance and document mode", () => {
    const names = [null, "", "html", "HTML", "svg"]
    const publicIds = [
      null,
      "",
      "html",
      "-//W3C//DTD HTML 4.01 Transitional//EN",
      "-//W3C//DTD XHTML 1.0 Frameset//EN",
      "-//IETF//DTD HTML 3.2//EN",
      "-//unknown//DTD HTML//EN",
    ]
    const systemIds = [null, "", "about:legacy-compat", "HTTP://WWW.IBM.COM/DATA/DTD/V11/IBMXHTML1-TRANSITIONAL.DTD", "other"]
    for (const name of names) {
      for (const publicId of publicIds) {
        for (const systemId of systemIds) {
          const token = { name, publicId, systemId }
          const args = [name ?? "", name !== null, publicId ?? "", publicId !== null, systemId ?? "", systemId !== null]
          assert.equal(lil.conformingDoctype(...args), isConforming(token), JSON.stringify(token))
          assert.equal(lil.documentMode(...args), getDocumentMode(token), JSON.stringify(token))
        }
      }
    }
  })

  it("matches Unicode and entity code-point handling", () => {
    for (let codePoint = 0; codePoint <= 0x110000; codePoint++) {
      assert.equal(lil.replacedCodePoint(codePoint), replaceCodePoint(codePoint), `replacement U+${codePoint.toString(16)}`)
      assert.equal(lil.surrogate(codePoint), unicode.isSurrogate(codePoint), `surrogate U+${codePoint.toString(16)}`)
      assert.equal(lil.trailingSurrogate(codePoint), unicode.isSurrogatePair(codePoint), `pair U+${codePoint.toString(16)}`)
      assert.equal(lil.controlCodePoint(codePoint), unicode.isControlCodePoint(codePoint), `control U+${codePoint.toString(16)}`)
      assert.equal(lil.undefinedCodePoint(codePoint), unicode.isUndefinedCodePoint(codePoint), `undefined U+${codePoint.toString(16)}`)
    }
    for (const codePoint of [0, 1, 0x7f, 0x80, 0x9f, 0xd7ff, 0xd800, 0xdfff, 0xe000, 0xffff, 0x10000, 0x10ffff, 0x110000]) {
      assert.equal(lil.decodedCodePoint(codePoint), decodeCodePoint(codePoint), `decode U+${codePoint.toString(16)}`)
    }
    assert.equal(lil.surrogatePair(0xd83d, 0xde00), unicode.getSurrogatePairCodePoint(0xd83d, 0xde00))
  })

  it("matches complete and incrementally supplied entity references", () => {
    const samples = [
      "",
      "plain text",
      "&amp;",
      "&amp",
      "&notit;",
      "&notin;",
      "&NotEqualTilde;",
      "&#0;",
      "&#128;",
      "&#x1f600;",
      "&#xD800;",
      "&#999999999999999999999999;",
      "a&amp;b&#x80;c&unknown;d",
      "&copycat=&copy &copy;",
    ]
    let state = 0x7315eed
    const alphabet = "&;#xX=0123456789abcdefABCDEFnotincopyampxyz "
    for (let caseIndex = 0; caseIndex < 1024; caseIndex++) {
      let value = ""
      const length = state % 48
      for (let index = 0; index < length; index++) {
        state = (Math.imul(state, 1103515245) + 12345) >>> 0
        value += alphabet[state % alphabet.length]
      }
      samples.push(value)
    }
    for (const input of samples) {
      assert.equal(lil.decodedHtml(input, 0), decodeHTML(input, DecodingMode.Legacy), `legacy ${JSON.stringify(input)}`)
      assert.equal(lil.decodedHtml(input, 1), decodeHTML(input, DecodingMode.Strict), `strict ${JSON.stringify(input)}`)
      assert.equal(lil.decodedHtml(input, 2), decodeHTML(input, DecodingMode.Attribute), `attribute ${JSON.stringify(input)}`)
      assert.equal(lil.decodedHtmlAttribute(input), decodeHTMLAttribute(input), `attribute helper ${JSON.stringify(input)}`)
      assert.equal(lil.decodedHtmlStrict(input), decodeHTMLStrict(input), `strict helper ${JSON.stringify(input)}`)
      assert.equal(lil.decodedXml(input), decodeXML(input), `XML ${JSON.stringify(input)}`)
    }

    const references = ["amp;", "amp", "notit;", "notin;", "NotEqualTilde;", "#0;", "#128;", "#x1f600;", "#xD800;", "#999999999999999999999999;", "unknown;"]
    for (const reference of references) {
      for (const mode of [DecodingMode.Legacy, DecodingMode.Strict, DecodingMode.Attribute]) {
        for (let splitAt = 0; splitAt <= reference.length; splitAt++) {
          const expectedEmitted = []
          const expectedErrors = []
          const actualErrors = []
          const expectedDecoder = new EntityDecoder(
            htmlDecodeTree,
            (codePoint, consumed) => expectedEmitted.push({ codePoint, consumed }),
            {
              missingSemicolonAfterCharacterReference() { expectedErrors.push("missing-semicolon") },
              absenceOfDigitsInNumericCharacterReference(consumed) { expectedErrors.push(`absence:${consumed}`) },
              validateNumericCharacterReference() { expectedErrors.push("validate") },
            },
          )
          expectedDecoder.startEntity(mode)
          const firstResult = expectedDecoder.write(reference.slice(0, splitAt), 0)
          let result = firstResult
          if (firstResult < 0) result = expectedDecoder.write(reference.slice(splitAt), 0)
          if (result < 0) result = expectedDecoder.end()
          const actual = lil.entityTrace(
            reference.slice(0, splitAt),
            reference.slice(splitAt),
            true,
            mode,
            {
              missingSemicolonAfterCharacterReference() { actualErrors.push("missing-semicolon") },
              absenceOfDigitsInNumericCharacterReference(consumed) { actualErrors.push(`absence:${consumed}`) },
              validateNumericCharacterReference() { actualErrors.push("validate") },
            },
          )
          assert.deepEqual(actual, { firstResult, result, emitted: expectedEmitted }, JSON.stringify({ reference, mode, splitAt }))
          assert.deepEqual(actualErrors, expectedErrors, JSON.stringify({ reference, mode, splitAt, errors: true }))
        }
      }
    }
  })

  it("matches foreign-content adjustment and integration rules", () => {
    const attrs = ["", "color", "size", "face", "href"]
    for (const name of tagNames) {
      for (const attrName of attrs) {
        const token = { tagID: html.getTagID(name), attrs: attrName ? [{ name: attrName, value: "" }] : [] }
        assert.equal(lil.exitsForeignContent(name, attrName), foreignContent.causesExit(token), `${name}:${attrName}`)
      }
    }
    for (const [lower, adjusted] of foreignContent.SVG_TAG_NAMES_ADJUSTMENT_MAP) {
      assert.equal(lil.adjustedSvgTag(lower), adjusted, lower)
    }
    for (const name of ["definitionurl", "definitionURL", "other"]) {
      const token = { attrs: [{ name, value: "" }] }
      foreignContent.adjustTokenMathMLAttrs(token)
      assert.equal(lil.adjustedMathAttribute(name), token.attrs[0].name, name)
    }
    for (const name of ["attributename", "basefrequency", "viewbox", "zoomandpan", "other"]) {
      const token = { attrs: [{ name, value: "" }] }
      foreignContent.adjustTokenSVGAttrs(token)
      assert.equal(lil.adjustedSvgAttribute(name), token.attrs[0].name, name)
    }
    for (const name of ["xlink:actuate", "xlink:arcrole", "xlink:href", "xlink:role", "xlink:show", "xlink:title", "xlink:type", "xml:lang", "xml:space", "xmlns", "xmlns:xlink", "other"]) {
      const token = { attrs: [{ name, value: "" }] }
      foreignContent.adjustTokenXMLAttrs(token)
      const attr = token.attrs[0]
      assert.equal(lil.adjustedXmlAttribute(name), `${attr.prefix ?? "-"}|${attr.name}|${attr.namespace ?? "-"}`, name)
    }
    const integrationCases = [
      ["annotation-xml", 1, "encoding", "text/html"],
      ["annotation-xml", 1, "encoding", "APPLICATION/XHTML+XML"],
      ["annotation-xml", 1, "encoding", "text/plain"],
      ["mi", 1, "", ""],
      ["foreignObject", 2, "", ""],
      ["desc", 2, "", ""],
      ["title", 2, "", ""],
      ["div", 0, "", ""],
    ]
    const namespaces = [html.NS.HTML, html.NS.MATHML, html.NS.SVG]
    for (const [name, namespaceIndex, attrName, attrValue] of integrationCases) {
      for (let foreignIndex = -1; foreignIndex < namespaces.length; foreignIndex++) {
        const attrs = attrName ? [{ name: attrName, value: attrValue }] : []
        const expected = foreignContent.isIntegrationPoint(
          html.getTagID(name),
          namespaces[namespaceIndex],
          attrs,
          foreignIndex < 0 ? undefined : namespaces[foreignIndex],
        )
        assert.equal(lil.integrationPoint(name, namespaceIndex, attrName, attrValue, foreignIndex), expected)
      }
    }
  })

  it("matches preprocessing across malformed input and chunk boundaries", () => {
    const samples = [
      "",
      "abc",
      "a\r\nb\rc\nd",
      "\0\u0001\u007f\u009f",
      "\ufdd0\ufffe\uffff",
      "\ud800",
      "\udc00",
      "a\ud83d\ude00b",
      "\ud83d\ude00\r\n\0",
    ]
    let state = 0x5eed7300
    const units = [0, 1, 9, 10, 13, 32, 65, 127, 159, 0xd7ff, 0xd800, 0xdbff, 0xdc00, 0xdfff, 0xe000, 0xfdd0, 0xfffe]
    for (let caseIndex = 0; caseIndex < 256; caseIndex++) {
      let value = ""
      const length = 1 + (state % 24)
      for (let index = 0; index < length; index++) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0
        value += String.fromCharCode(units[state % units.length])
      }
      samples.push(value)
    }
    for (const input of samples) {
      const splits = new Set([0, Math.floor(input.length / 2), input.length])
      for (const splitAt of splits) {
        const expectedErrors = []
        const actualErrors = []
        const preprocessor = new Preprocessor({ onParseError: (error) => expectedErrors.push(error) })
        const expectedCodePoints = []
        preprocessor.write(input.slice(0, splitAt), false)
        while (true) {
          const codePoint = preprocessor.advance()
          if (codePoint === unicode.CODE_POINTS.EOF) break
          expectedCodePoints.push(codePoint)
        }
        preprocessor.retreat(1)
        preprocessor.write(input.slice(splitAt), true)
        while (true) {
          const codePoint = preprocessor.advance()
          if (codePoint === unicode.CODE_POINTS.EOF) break
          expectedCodePoints.push(codePoint)
        }
        const actual = lil.preprocessTrace(input.slice(0, splitAt), input.slice(splitAt), true, (error) => actualErrors.push(error))
        assert.deepEqual(actual, {
          codePoints: expectedCodePoints,
          line: preprocessor.line,
          col: preprocessor.col,
          offset: preprocessor.offset,
          endOfChunkHit: preprocessor.endOfChunkHit,
        }, JSON.stringify({ input, splitAt }))
        assert.deepEqual(actualErrors, expectedErrors, JSON.stringify({ input, splitAt, errors: true }))
      }
    }
  })

  it("matches preprocessor lookahead, insertion, and buffer dropping", () => {
    const preprocessor = new Preprocessor({ onParseError: undefined })
    preprocessor.write("Ab\r\ncd", false)
    const first = preprocessor.advance()
    const sensitive = preprocessor.startsWith("Ab", true)
    const insensitive = preprocessor.startsWith("ab", false)
    const peekCr = preprocessor.peek(2)
    const peekPastEnd = preprocessor.peek(100)
    const chunkHit = preprocessor.endOfChunkHit
    preprocessor.insertHtmlAtCurrentPos("XY")
    const inserted = preprocessor.advance()
    preprocessor.bufferWaterline = 0
    const willDrop = preprocessor.willDropParsedChunk()
    preprocessor.dropParsedChunk()
    assert.deepEqual(lil.preprocessorMethodTrace(), {
      first,
      sensitive,
      insensitive,
      peekCr,
      peekPastEnd,
      chunkHit,
      inserted,
      willDrop,
      html: preprocessor.html,
      position: preprocessor.pos,
      offset: preprocessor.offset,
    })
  })

  it("matches the default tree adapter's mutation semantics", () => {
    const trace = lil.treeAdapterTrace()
    assert.equal(trace.mode, "quirks")
    assert.equal(trace.firstChild.tagName, "div")
    assert.equal(trace.parent.tagName, "div")
    assert.deepEqual(trace.attrs, [{ name: "id", value: "a" }, { name: "class", value: "added" }])
    assert.equal(trace.tagName, "div")
    assert.equal(trace.namespace, html.NS.HTML)
    assert.equal(trace.text, "cd")
    assert.equal(trace.comment, "note")
    assert.equal(trace.doctypeName, "html")
    assert.equal(trace.doctypePublic, "public")
    assert.equal(trace.doctypeSystem, "system")
    assert.equal(trace.isText, true)
    assert.equal(trace.isComment, true)
    assert.equal(trace.isDoctype, true)
    assert.equal(trace.isElement, true)
    assert.deepEqual(trace.templateContent, { nodeName: "#document-fragment", childNodes: [] })
    assert.deepEqual(trace.location, { startLine: 1, startCol: 2, startOffset: 1, endLine: 2, endCol: 1, endOffset: 4 })
    assert.equal(trace.detachedParent, null)
    assert.deepEqual(trace.remainingChildren.map((node) => node.value), ["ab", "cd"])

    const officialDocument = defaultTreeAdapter.createDocument()
    assert.deepEqual({ nodeName: trace.firstChild.parentNode.nodeName, mode: trace.mode }, { nodeName: officialDocument.nodeName, mode: html.DOCUMENT_MODE.QUIRKS })
  })

  it("matches active-formatting-list ordering and Noah's Ark enforcement", () => {
    const list = new FormattingElementList(defaultTreeAdapter)
    const token = (tagName, attrs = []) => ({ type: 3, tagName, tagID: html.getTagID(tagName), selfClosing: false, ackSelfClosing: false, attrs, location: null })
    const element = (tagName, attrs = []) => defaultTreeAdapter.createElement(tagName, html.NS.HTML, attrs)
    const bToken = token("b", [{ name: "class", value: "same" }])
    for (let index = 0; index < 4; index++) list.pushElement(element("b", [{ name: "class", value: "same" }]), bToken)
    const afterNoah = list.entries.length
    list.insertMarker()
    const italic = element("i")
    list.pushElement(italic, token("i"))
    const bHiddenByMarker = list.getElementEntryInScopeWithTagName("b") === null
    const italicEntry = list.getElementEntry(italic)
    const foundItalic = italicEntry != null
    list.bookmark = italicEntry
    list.insertElementAfterBookmark(element("em"), token("em"))
    list.removeEntry(italicEntry)
    const beforeClear = list.entries.length
    list.clearToLastMarker()
    const afterClear = list.entries.length
    list.removeEntry(list.getElementEntryInScopeWithTagName("b"))
    assert.deepEqual(lil.formattingListTrace(), {
      afterNoah,
      bHiddenByMarker,
      foundItalic,
      beforeClear,
      afterClear,
      afterRemove: list.entries.length,
    })
  })

  it("matches open-element-stack mutation, scope, and callback ordering", () => {
    const pushed = []
    const popped = []
    const document = defaultTreeAdapter.createDocument()
    const stack = new OpenElementStack(document, defaultTreeAdapter, {
      onItemPush(element, _id, current) { pushed.push({ name: defaultTreeAdapter.getTagName(element), current }) },
      onItemPop(element, current) { popped.push({ name: defaultTreeAdapter.getTagName(element), current }) },
    })
    const element = (name) => defaultTreeAdapter.createElement(name, html.NS.HTML, [])
    const htmlElement = element("html")
    const body = element("body")
    const paragraph = element("p")
    stack.push(htmlElement, html.TAG_ID.HTML)
    stack.push(body, html.TAG_ID.BODY)
    stack.push(paragraph, html.TAG_ID.P)
    const bodyPeek = stack.tryPeekProperlyNestedBodyElement() === body
    const pScope = stack.hasInScope(html.TAG_ID.P)
    const pButtonScope = stack.hasInButtonScope(html.TAG_ID.P)
    const liListScope = stack.hasInListItemScope(html.TAG_ID.LI)
    const section = element("section")
    stack.insertAfter(body, section, html.TAG_ID.SECTION)
    const main = element("main")
    stack.replace(section, main)
    const ancestor = stack.getCommonAncestor(paragraph) === main
    stack.remove(main)
    stack.push(element("li"), html.TAG_ID.LI)
    stack.push(element("option"), html.TAG_ID.OPTION)
    stack.generateImpliedEndTags()
    const impliedStoppedAtP = stack.current === paragraph
    const template = element("template")
    const content = defaultTreeAdapter.createDocumentFragment()
    defaultTreeAdapter.setTemplateContent(template, content)
    stack.push(template, html.TAG_ID.TEMPLATE)
    const templateCurrent = stack.currentTmplContentOrNode === content
    const templateCount = stack.tmplCount
    stack.pop()
    const rootCurrent = stack.isRootHtmlElementCurrent()
    const tableScope = stack.hasInTableScope(html.TAG_ID.TABLE)
    const tableBodyScope = stack.hasTableBodyContextInTableScope()
    const selectScope = stack.hasInSelectScope(html.TAG_ID.OPTION)
    const headerScope = stack.hasNumberedHeaderInScope()
    stack.generateImpliedEndTagsThoroughly()
    stack.generateImpliedEndTagsWithExclusion(html.TAG_ID.P)
    stack.clearBackToTableRowContext()
    stack.clearBackToTableBodyContext()
    stack.clearBackToTableContext()
    stack.popAllUpToHtmlElement()
    assert.deepEqual(lil.openElementStackTrace(), {
      bodyPeek,
      pScope,
      pButtonScope,
      liListScope,
      ancestor,
      impliedStoppedAtP,
      templateCurrent,
      templateCount,
      rootCurrent,
      tableScope,
      tableBodyScope,
      selectScope,
      headerScope,
      stackTop: stack.stackTop,
      current: defaultTreeAdapter.getTagName(stack.current),
      pushed,
      popped,
    })
  })
})
