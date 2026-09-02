import { writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { htmlDecodeTree } from "../node_modules/entities/dist/esm/generated/decode-data-html.js"
import { xmlDecodeTree } from "../node_modules/entities/dist/esm/generated/decode-data-xml.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function source(name, tree) {
  let packed = ""
  for (const value of tree) packed += String.fromCharCode(value)
  return `// Generated from entities' decode trie. Do not edit by hand.
string packed = ${JSON.stringify(packed)};

int[] buildDecodeTree(string data) {
  int[] tree = [];
  int i = 0;
  while (i < data.length) {
    tree.push(data.charCodeAt(i));
    i = i + 1;
  }
  return tree;
}

export int[] ${name} = buildDecodeTree(packed);
`
}

writeFileSync(
  resolve(root, "src/parse5/entities/generated/decode-data-html.lil"),
  source("htmlDecodeData", htmlDecodeTree),
)
writeFileSync(
  resolve(root, "src/parse5/entities/generated/decode-data-xml.lil"),
  source("xmlDecodeData", xmlDecodeTree),
)
