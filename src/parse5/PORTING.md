# parse5 7.3.0 port status

All sixteen runtime modules are implemented in LilScript. Rehype imports the
parser directly from `parser/index.lil`; there is no parse5 JavaScript runtime
bridge in the shipped graph.

The port covers the exact runtime graph reached by rehype's
`parseDocument(html, options)` and `parseFragment(html, options)` calls:

| Runtime module | LilScript status |
| --- | --- |
| `common/doctype.js` | complete in `common/doctype.lil` |
| `common/error-codes.js` | complete in `common/error-codes.lil` |
| `common/foreign-content.js` | complete in `common/foreign-content.lil` |
| `common/html.js` | complete in `common/html.lil` |
| `common/token.js` | complete in `common/token.lil` |
| `common/unicode.js` | complete in `common/unicode.lil` |
| `tokenizer/preprocessor.js` | complete in `tokenizer/preprocessor.lil` |
| `tokenizer/index.js` | complete in `tokenizer/index.lil` |
| `parser/open-element-stack.js` | complete in `parser/open-element-stack.lil` |
| `parser/formatting-element-list.js` | complete in `parser/formatting-element-list.lil` |
| `parser/index.js` | complete in `parser/index.lil` |
| `tree-adapters/default.js` | complete in `tree-adapters/default.lil` |
| `entities/decode-codepoint.js` | complete in `entities/decode-codepoint.lil` |
| `entities/decode.js` | complete in `entities/decode.lil` |
| `entities/generated/decode-data-html.js` | generated static data in `entities/generated/decode-data-html.lil` |
| `entities/generated/decode-data-xml.js` | generated static data in `entities/generated/decode-data-xml.lil` |

The parser port includes every insertion mode, foster parenting, the
adoption-agency algorithm, templates, fragment contexts, foreign-content
dispatch, and parser-side source-location updates.

`test/parse5-modules.test.mjs` compiles `test/parse5-modules.lil` and compares
the completed modules directly with parse5 7.3.0 and entities. It covers every
tag ID and special-element set, all error-code values, the doctype modes, every
Unicode code point, entity decoding and streaming splits, randomized chunked
preprocessing, foreign-content adjustments, tree-adapter mutations, active
formatting entries, and open-element stack behavior.
`npm run test:parse5-parser` compiles the Lil parser directly and compares tree
shape, locations, errors, fragment contexts, scripting modes, and stack callback
order against parse5 7.3.0 over the complete parser corpus and deterministic
malformed fuzz cases.
`npm run test:parse5-tokenizer` compiles only the Lil tokenizer and its
adapter, then compares tokens, errors, callback order, locations, hibernation,
all initial modes, foreign CDATA, pause/resume, insertion, and write callbacks
against parse5 7.3.0 over the complete html5lib tokenizer corpus and 12,000
deterministic malformed inputs.
Regenerate the two static trie modules with `npm run generate:parse5-entities`.

Verification commands:

```sh
npm run build
npm test
npm run test:parse5-corpus
npm run test:parse5-parser
npm run test:parse5-tokenizer
npm run check:pack
npm run check:site
npm run check:brotli
```

`test:parse5-corpus` expects the parse5 7.3.0 repository, including its pinned
html5lib submodules, at `.tmp/parse5`. Paths can instead be passed explicitly.
