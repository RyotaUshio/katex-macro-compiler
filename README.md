# katex-macro-compiler

Transpile LaTeX macro definitions into a KaTeX `macros` object.  
Zero-fuss way to keep your LaTeX macros in one place while rendering with KaTeX.

## Why this exists

Managing macros per engine (real LaTeX, MathJax, KaTeX, ...) is painful; you want **one source of truth** for macros.
However, KaTeX expects a JavaScript object, not `.sty` syntax, so we need some conversion tool.

KaTeX lacks some LaTeX features, so simply rewriting `.sty` to a JSON object often fails (`\newcommand` with optional args, `\DeclareMathOperator`, etc.).  
This tool **expands/rewrites** where needed so macros actually work under KaTeX.

## What it does

- **Parses** a LaTeX preamble / `.sty` text and produces a KaTeX `macros` map.
- **Optional arguments**: fixes them to their default values (KaTeX lacks defaulted optionals).
- **Dependency expansion**: if a macro uses another optional-arg macro, expands until no such dependency remains.
- **Operators**: converts
  - `\DeclareMathOperator{\foo}{bar}` → `\operatorname{bar}`
  - `\DeclareMathOperator*{\Foo}{Bar}` → `\operatorname*{Bar}`

## Install

```bash
npm i katex-macro-compiler
# or
pnpm add katex-macro-compiler
# or
yarn add katex-macro-compiler
```

## Usage

```ts
import { parseMacros } from "katex-macro-compiler";
import * as fs from "node:fs";

const source = fs.readFileSync("macros.sty", "utf-8");
const macros = parseMacros(source);
```

Then pass `macros` to your KaTeX config.
See also [https://katex.org/docs/options.html](https://katex.org/docs/options.html).

## Example

**Input (`macros.sty`):**

```tex
\newcommand{\R}{\mathbb{R}}

% brackets
\newcommand{\norm}[2][]{\left\lVert #2 \right\rVert_{#1}}
\newcommand{\supnorm}[1]{\norm[\infty]{#1}}

% operators
\DeclareMathOperator*{\argmax}{arg\,max}
```

**Output (JS object for KaTeX):**

```json
{
  "\\R": "\\mathbb{R}",
  "\\norm": "\\left\\lVert #1 \\right\\rVert_{}",
  "\\enorm": "\\left\\lVert #1 \\right\\rVert_{\\infty}",
  "\\argmax": "\\operatorname*{arg\\,max}"
}
```

Notes:

- `\norm`’s optional `[#1]` becomes `_{}`
- `\enorm` expands `\norm[2]{…}` to a concrete subscript
- `\DeclareMathOperator` forms become the appropriate `\operatorname` variants

## Supported constructs (subset)

- `\newcommand`, `\renewcommand` with up to 9 arguments
- Optional argument **with default only** (fixed at compile time)
- `\DeclareMathOperator` / `\DeclareMathOperator*`
- Nested macro references (expanded to remove optional-arg dependencies)
- Comments (`% ...`) are ignored

## Limitations

- File inclusion (`\input`, `\usepackage`) is out of scope—provide aggregated text yourself.
- Not a TeX engine; no catcode/conditionals/`\edef`/`\csname` magic.
