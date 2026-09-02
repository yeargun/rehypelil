# Notices

`@itslil/rehype` is an independent LilScript reimplementation of
[`rehype`](https://github.com/rehypejs/rehype). It is not affiliated with or
endorsed by the upstream authors.

Algorithms and public API names derive from that project, distributed under
the MIT license. The original license notice is preserved in [LICENSE](./LICENSE).

This package vendors official `unified`, `rehype-stringify` /
`hast-util-to-html`, `hast-util-from-html`, `hast-util-from-parse5`, and
`vfile-message` algorithms, and reimplements the parse5 runtime in LilScript.

The parse5-derived parser modules retain this notice:

Copyright (c) 2013-2019 Ivan Nikulin (ifaaan@gmail.com,
https://github.com/inikulin). Distributed under the MIT License.

The generated entity trie and entities-derived decoder retain this notice:

Copyright (c) Felix Böhm
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this
list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice,
this list of conditions and the following disclaimer in the documentation
and/or other materials provided with the distribution.

THIS IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

The LilScript compiler is developed separately at
[yeargun/lilscript](https://github.com/yeargun/lilscript).
