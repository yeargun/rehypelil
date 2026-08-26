export interface Processor {
  parser?: (doc: unknown, file?: unknown) => unknown
  compiler?: (tree: unknown, file?: unknown) => unknown
  use(plugin: unknown, options?: unknown): Processor
  parse(file?: unknown): unknown
  runSync(tree: unknown, file?: unknown): unknown
  run(tree: unknown, file?: unknown): Promise<unknown>
  stringify(tree: unknown, file?: unknown): unknown
  processSync(input: unknown): unknown
  process(input: unknown): Promise<unknown>
  data(): Record<string, unknown>
  data(key: string): unknown
  data(key: string, value: unknown): Processor
  freeze(): Processor
}

export const rehype: Processor & (() => Processor)
export function rehypeParse(this: Processor, options?: unknown): void
export function rehypeStringify(this: Processor, options?: unknown): void
export default rehype
