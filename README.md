# @itslil/rehype

rehype reimplemented in LilScript. This is **not** the official [`rehype`](https://github.com/rehypejs/rehype) package.

**Site:** [yeargun.github.io/rehypelil/](https://yeargun.github.io/rehypelil/)

```sh
npm install @itslil/rehype
```

Two compiles ship from the same `.lil` source:

| Lane | Config | Meaning |
| --- | --- | --- |
| **library** (npm) | `lilscript.toml` · `--target js-module` | reusable ESM. Export names and `extern class` keys stay. |
| **closed** | `lilscript.closed.toml` · `--target js-module` | closed LilScript world. `extern class` keys may mangle. ESM export names stay so the lane is testable. |

You publish the library lane. The closed artifact is `dist/rehype.closed.js`.

The LilScript compiler lives next door at `../lilscript`.
