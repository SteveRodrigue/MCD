# Setting up the official PDFs

The official Rules Reference and rulebook PDFs are not part of this repository. Gameplay rules research uses the tracked Markdown in [`rules/`](rules/) through `npm run rule -- <term>`. A scenario's own rules are only in its rulebook, so keep a local copy to read them.

## Local rulebooks

Download the rulebooks, rulesheets, campaign logs and print-and-play files from the official Fantasy Flight support page listed in [`links.md`](links.md) into `references/rulesheets/`. Git ignores every `*.pdf` under `references/`.

## When you need the PDF

Only to regenerate the Markdown (for example for a new Rules Reference version):

1. Download the Rules Reference from the official Fantasy Flight support page listed in [`links.md`](links.md).
2. Save it as `references/mc_rulesreference_v18_compressed.pdf`. Git ignores every `*.pdf` under `references/`.
3. Run `python tools/build_rules_markdown.py` to rewrite `rules/` and `rules_reference_v18.md`.

## The leak guard

`npm run leak:check` (pre-commit, `npm run verify` and CI) fails when a PDF, an image, a cache folder or a file over 5 MB is tracked, or when upstream card data sits outside `content/packs/`. Exceptions go in `tools/audit/leak-guard.allow.json` with a reason.
