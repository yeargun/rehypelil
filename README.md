# @itslil/rehype

Official [`rehype@13.0.2`](https://github.com/rehypejs/rehype) algorithms rewritten in LilScript. The upstream API, fixture, and parse-error tests run against the port with local import shims. Not affiliated with upstream.

**Site:** [yeargun.github.io/rehypelil/](https://yeargun.github.io/rehypelil/)

```sh
npm install @itslil/rehype
```

Two compiles ship from the same `.lil` source:

| Lane | Config | Meaning |
| --- | --- | --- |
| **library** (npm) | `lilscript.toml` · `--target js-module` | Reusable ESM with the upstream named `rehype` export. |
| **closed** | `lilscript.closed.toml` · `--target js-module` | Closed-world layout experiment built from the same typed source. |

You publish the full-graph library lane. `dist/rehype.closed.js` is diagnostic only.

The LilScript compiler lives next door at `../lilscript`.

Source modules follow their upstream package paths, such as `src/index.lil`,
`src/rehype-parse/lib/index.lil`, and `src/unified/lib/index.lil`. The complete
parse5 7.3.0 runtime graph used by rehype is also implemented in LilScript; no
parse5 or entities JavaScript runtime is bundled. The module inventory and
corpus commands are recorded in
[`src/parse5/PORTING.md`](src/parse5/PORTING.md).
