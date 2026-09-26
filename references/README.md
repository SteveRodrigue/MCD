# References Directory (External Ground Truth / Read-Only)

This directory serves as the **immutable external ground truth** repository for Marvel Champions Digital (MCD).

---

## Directory Contents

* **[`links.md`](links.md):** Authoritative external links (MarvelCDB FAQs, Card Explorer discussion templates, Hall of Heroes rulings archive, FFG official rules support).
* **[`rules/`](rules/):** **Primary Rules Reference.** Structured, modularized Markdown translation of Rules Reference v1.8 (Glossary A–Z, Appendices I–VI, `TOPIC_MAP.md`, and machine-readable dependency graph).
* **[`rules_reference_v18.md`](rules_reference_v18.md):** Unabridged monolithic Markdown version of Rules Reference v1.8.
* **[`mc_rulesreference_v18_compressed.pdf`](mc_rulesreference_v18_compressed.pdf):** Official Rules Reference v1.8 (Immutable external binary source). Agents should consult `rules/` instead of opening this PDF directly.

### Quick Rules Lookup
```powershell
python scripts/lookup-rule.py "toughness"
# or
npm run rule -- "toughness"
```

---

> [!NOTE]
> Files in this directory represent external rules, rulings, and standards from Fantasy Flight Games and the Marvel Champions community. For the project-authored algorithmic rules mapping, architecture, developer specifications, and audit reports, refer to the [`docs/`](../docs/) directory.
