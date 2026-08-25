export interface Options {
  allowDangerousHtml?: boolean
}

export interface VFile {
  value: unknown
  result: unknown
  messages: unknown[]
  data: Record<string, unknown>
}

export interface Processor {
  parser?: (doc: unknown, file?: unknown) => unknown
  compiler?: (tree: unknown, file?: unknown) => unknown
  use(plugin: unknown, options?: unknown): Processor
  parse(file?: unknown): unknown
  runSync(tree: unknown, file?: unknown): unknown
  run(tree: unknown, file?: unknown): Promise<unknown>
  stringify(tree: unknown, file?: unknown): unknown
  processSync(input: unknown): VFile
  process(input: unknown): Promise<VFile>
  data(): Record<string, unknown>
  data(key: string): unknown
  data(key: string, value: unknown): Processor
}

export function rehype(): Processor
export default rehype
