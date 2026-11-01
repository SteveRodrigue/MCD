# References Directory (External Ground Truth / Read-Only)

This directory serves as the **immutable external ground truth** repository for Marvel Champions Digital (MCD).

---

## Directory Contents

* **[`links.md`](links.md):** Authoritative external links (MarvelCDB FAQs, Card Explorer discussion templates, Hall of Heroes rulings archive, FFG official rules support).
* **[`rules/`](rules/):** **Primary Rules Reference.** Structured, modularized Markdown translation of Rules Reference v1.8 (Glossary A–Z, Appendices I–VI, `TOPIC_MAP.md`, and machine-readable dependency graph).
* **[`rules_reference_v18.md`](rules_reference_v18.md):** Unabridged monolithic Markdown version of Rules Reference v1.8.
* **Official PDFs (not tracked):** the Rules Reference and rulesheet PDFs are never committed (`npm run leak:check` fails if one is). Download them yourself, see [`SETUP.md`](SETUP.md). Use `rules/` instead of opening a PDF directly.

### Quick Rules Lookup
```powershell
npm run rule -- "toughness"
# or
npm run rule -- "toughness"
```

---

> [!NOTE]
> Files in this directory represent external rules, rulings, and standards from Fantasy Flight Games and the Marvel Champions community. For the project-authored algorithmic rules mapping, architecture, developer specifications, and audit reports, refer to the [`docs/`](../docs/) directory.
