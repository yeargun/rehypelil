import type {Root} from "hast"
import type {Processor} from "unified"
import * as api from "@itslil/rehype"

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false

const exactExports: Equal<keyof typeof api, "rehype"> = true
const processor: Processor<Root, undefined, undefined, Root, string> = api.rehype
const result: string = processor.stringify({type: "root", children: []})

void exactExports
void result
