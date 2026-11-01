# Setting up the official PDFs

The official Rules Reference and rulesheet PDFs are not part of this repository. Everyday work does not need them: `npm run rule -- <term>` reads the tracked Markdown in [`rules/`](rules/).

## When you need the PDF

Only to regenerate the Markdown (for example for a new Rules Reference version):

1. Download the Rules Reference from the official Fantasy Flight support page listed in [`links.md`](links.md).
2. Save it as `references/mc_rulesreference_v18_compressed.pdf`. Git ignores every `*.pdf` under `references/`.
3. Run `python tools/build_rules_markdown.py` to rewrite `rules/` and `rules_reference_v18.md`.

## The leak guard

`npm run leak:check` (pre-commit, `npm run verify` and CI) fails when a PDF, an image, a cache folder or a file over 5 MB is tracked, or when upstream card data sits outside `content/packs/`. Exceptions go in `tools/audit/leak-guard.allow.json` with a reason.
