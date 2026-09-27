# Source-build measurements

Measured 2026-09-27T16:11:00Z using LilScript `249686599dc3bf1b6bf70dc9a030081b755bbb24` and the upstream Git revision recorded in `job.json`.

`result.json` records the commands, wall time, CPU time, machine and exit codes. `esm.json` records the production ESM assembly and exact input graph. The lockfiles record dependency resolution. The public page uses `source-build.json` for the final consolidated record.

Run the installation and setup commands from `job.json` in the corresponding pinned upstream checkout; they are excluded from build time. Run the recorded build command with Node v24.11.1. Clear the listed generated output directories between repetitions. Install the port dependencies and set `LILSCRIPT_COMPILER`, `MOTIONLIL_LILSCRIPT_BIN`, `SOLIDLIL_LILSCRIPT_BIN`, `LILSCRIPT_ROOT` and `LILSCRIPT_CODEC` to the recorded compiler and codec as applicable. Some ports import sibling LilScript source trees.

The original repository build and comparison ESM assembly are measured separately. Build output scope can differ between repositories; no build speedup is inferred. Both lanes ran on the same burstable Azure VM, which other sessions shared during the run.
