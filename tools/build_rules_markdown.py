"""
Script to extract and format Marvel Champions Rules Reference v1.8 from PDF into:
1. references/rules_reference_v18.md (Monolithic Markdown)
2. references/rules/ (Modular directory with README.md, TOPIC_MAP.md, rules_graph.json, glossary/A-Z.md, appendices/)
"""

import os
import sys
import re
import json
import pypdf
from typing import Dict, List, Tuple, Any

GLYPH_MAP = {
    '\uf520': '[boost]',
    '\uf521': '[amplify]',
    '\uf522': '[consequential-damage]',
    '\uf524': '[per-player]',
    '\uf525': '[wild]',
    '\uf526': '[physical]',
    '\uf527': '[mental]',
    '\uf528': '[energy]',
    '\uf52d': '[star]',
    '\uf52e': '[crisis]',
    '\uf52f': '[hazard]',
    '\uf530': '[acceleration]',
    '\uf531': '[unique]',
    '\ufffd': '—',
}

DIAGRAM_LINES = {
    '© MARVEL © 2019 FFG', 'ENCOUNTER GROUP (XX/XX)', 'WEAPON.',
    'RHINO (8/21)', 'IRON MAN NEMESIS (3/5)', 'PLAYER DECKS',
    'GLOSSARYGLOSSARY', 'GLOSSARY', 'OVERVIEWOVERVIEW', 'OVERVIEW'
}

def clean_text(text: str) -> str:
    for k, v in GLYPH_MAP.items():
        text = text.replace(k, v)
    text = re.sub(r'\n\d+\s*\nRu\s*l\s*e\s*s\s*R\s*e\s*f\s*e\s*R\s*e\s*n\s*c\s*e', '', text)
    text = re.sub(r'\d+\s*\nRu\s*l\s*e\s*s\s*R\s*e\s*f\s*e\s*R\s*e\s*n\s*c\s*e', '', text)
    text = re.sub(r'\n\d+Ru\s*l\s*e\s*s\s*R\s*e\s*f\s*e\s*R\s*e\s*n\s*c\s*e', '', text)
    text = text.replace('• •', '- ')
    text = text.replace('•', '- ')
    text = text.replace('\u00a0', ' ')
    return text

def make_anchor(title: str) -> str:
    s = title.lower()
    s = clean_text(s)
    s = re.sub(r'\[[a-z\-]+\]', '', s)
    s = re.sub(r'[“”"\'\(\)\,\.\/\[\]\:\→]', '', s)
    s = re.sub(r'\s+', '-', s.strip())
    s = re.sub(r'-+', '-', s)
    return s.strip('-')

def get_letter_group(title: str) -> str:
    clean_t = re.sub(r'^[“"\'\s]+', '', title)
    for c in clean_t:
        if c.isalpha():
            return c.upper()
    return 'OTHER'

def normalize_body_see_also(body: str) -> str:
    lines = body.splitlines()
    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r'^(See(?:\s+also)?\s*:\s*)(.*)$', line, re.IGNORECASE)
        if m:
            prefix = m.group(1)
            content = m.group(2).strip()
            i += 1
            while i < len(lines) and lines[i].strip() and not lines[i].strip().startswith(('-', '*', '#', '•')):
                content += " " + lines[i].strip()
                i += 1
            new_lines.append(f"{prefix}{content}")
        else:
            new_lines.append(line)
            i += 1
    return "\n".join(new_lines)

PACK_NAMES = [
    "CORE SET",
    "THE WRECKING CREW SCENARIO PACK",
    "CAPTAIN AMERICA HERO PACK",
    "THOR HERO PACK",
    "BLACK WIDOW HERO PACK",
    "DOCTOR STRANGE HERO PACK",
    "HULK HERO PACK",
    "RISE OF RED SKULL EXPANSION",
    "WASP HERO PACK",
    "GALAXY’S MOST WANTED EXPANSION",
    "STAR-LORD HERO PACK",
    "MAD TITAN’S SHADOW EXPANSION",
    "NEBULA HERO PACK",
    "WAR MACHINE HERO PACK",
    "VALKYRIE HERO PACK",
    "VISION HERO PACK",
    "SINISTER MOTIVES EXPANSION",
    "NOVA HERO PACK",
    "IRONHEART HERO PACK",
    "SP/ /DR HERO PACK",
    "MUTANT GENESIS EXPANSION",
    "WOLVERINE HERO PACK",
    "STORM HERO PACK",
    "GAMBIT HERO PACK",
    "ROGUE HERO PACK",
    "MOJOMANIA SCENARIO PACK",
    "NEXT EVOLUTION EXPANSION",
    "X-23 HERO PACK",
    "DEADPOOL HERO PACK",
    "AGE OF APOCALYPSE EXPANSION",
    "NIGHTCRAWLER HERO PACK",
    "MAGNETO HERO PACK",
    "AGENTS OF S.H.I.E.L.D. EXPANSION",
    "SILK HERO PACK",
    "WINTER SOLDIER HERO PACK",
    "CIVIL WAR EXPANSION",
    "SYNTHEZOID SMACKDOWN SCENARIO PACK",
    "WONDER MAN HERO PACK"
]

def format_card_errata(raw: str) -> str:
    if 'ERRATAERRATA' in raw:
        raw = raw.split('ERRATAERRATA', 1)[1]
    elif 'ERRATA' in raw:
        raw = raw.split('ERRATA', 1)[1]

    processed = raw
    for p in PACK_NAMES:
        words = p.split()
        pat_str = r'\s+'.join(re.escape(w) for w in words)
        pattern = re.compile(rf'(\s*)({pat_str})', re.IGNORECASE)
        processed = pattern.sub(r'\n@@PACK@@ \2\n', processed)

    pack_sections = processed.split('@@PACK@@')

    formatted_output = ["# Appendix V: Card Errata\n\n[← Back to Master Rules Index](../README.md)\n"]
    formatted_output.append("> Official errata and text revisions from Rules Reference v1.8, organized by pack and card.\n")
    formatted_output.append("## Table of Contents by Pack\n")

    parsed_data = []
    card_title_pattern = re.compile(r'^(.*?)\s*\(#([^)]+)\)$')

    for sec in pack_sections[1:]:
        lines = [l.strip() for l in sec.splitlines() if l.strip()]
        if not lines:
            continue
        pack_raw = lines[0]
        pack_name = " ".join(pack_raw.split()).title()
        pack_name = pack_name.replace("Sp/ /Dr", "SP//dr").replace("S.H.I.E.L.D.", "S.H.I.E.L.D.")

        cards = []
        curr_card = None
        curr_card_body = []

        for l in lines[1:]:
            m = card_title_pattern.match(l)
            if m and len(l) < 65:
                if curr_card:
                    cards.append((curr_card, " ".join(curr_card_body).strip()))
                curr_card = l
                curr_card_body = []
            else:
                curr_card_body.append(l)

        if curr_card:
            cards.append((curr_card, " ".join(curr_card_body).strip()))

        parsed_data.append((pack_name, cards))

    for pack_name, cards in parsed_data:
        anchor = re.sub(r'[^a-z0-9]+', '-', pack_name.lower()).strip('-')
        formatted_output.append(f"- [{pack_name}](#{anchor}) ({len(cards)} card{'s' if len(cards) != 1 else ''})")

    formatted_output.append("\n---\n")

    for pack_name, cards in parsed_data:
        formatted_output.append(f"## {pack_name}\n")
        for card_title, card_body in cards:
            formatted_output.append(f"### {card_title}\n")

            m_read = re.search(r'Should read:\s*“(.*?)”\s*(?:\((.*?)\))?$', card_body)
            if m_read:
                errata_text = m_read.group(1).strip()
                explanation = m_read.group(2)
                formatted_output.append(f"**Official Errata:**\n> “{errata_text}”\n")
                if explanation:
                    formatted_output.append(f"**Change Note:**\n*({explanation.strip()})*\n")
            else:
                formatted_output.append(f"**Official Errata:**\n> {card_body}\n")
            formatted_output.append("")
        formatted_output.append("---\n")

    return "\n".join(formatted_output)

def format_faq(raw: str) -> str:
    if 'FAQAPPENDIX IV: FAQ' in raw:
        raw = raw.split('FAQAPPENDIX IV: FAQ', 1)[1]
    elif 'FAQ' in raw:
        raw = raw.split('FAQ', 1)[1]

    processed = raw
    for p in PACK_NAMES:
        words = p.split()
        pat_str = r'\s+'.join(re.escape(w) for w in words)
        pattern = re.compile(rf'(\s+)({pat_str})\b')
        processed = pattern.sub(r'\n\n\2\n\n', processed)

    lines = [l.strip() for l in processed.splitlines() if l.strip()]

    out = ["# Appendix IV: FAQ (Frequently Asked Questions)\n\n[← Back to Master Rules Index](../README.md)\n"]
    out.append("> Official rulings and answers to frequently asked gameplay questions from Rules Reference v1.8.\n\n---\n")

    def is_section_header(l: str) -> bool:
        letters = [c for c in l if c.isalpha()]
        if not (len(letters) >= 3 and all(c.isupper() for c in letters)):
            return False
        return (l in PACK_NAMES) or any(kw in l for kw in ('PACK', 'SET', 'EXPANSION', 'QUESTIONS', 'SCENARIO'))

    i = 0
    while i < len(lines):
        line = lines[i]
        is_card = re.search(r'\(#[^)]+\)', line)

        if not line.startswith('Q:') and not line.startswith('A:') and not is_card and is_section_header(line):
            out.append(f"\n## {' '.join(line.split()).title()}\n")
            i += 1
            continue

        if is_card and line.isupper():
            out.append(f"\n### {line}\n")
            i += 1
            continue

        if line.startswith('Q:'):
            q_lines = [line[2:].strip()]
            i += 1
            while i < len(lines) and not lines[i].startswith('A:') and not lines[i].startswith('Q:') and not (re.search(r'\(#[^)]+\)', lines[i]) and lines[i].isupper()) and not is_section_header(lines[i]):
                q_lines.append(lines[i])
                i += 1
            question = " ".join(q_lines)
            out.append(f"**Q: {question}**\n")

            if i < len(lines) and lines[i].startswith('A:'):
                a_lines = [lines[i][2:].strip()]
                i += 1
                while i < len(lines) and not lines[i].startswith('Q:') and not lines[i].startswith('A:') and not is_section_header(lines[i]) and not (re.search(r'\(#[^)]+\)', lines[i]) and lines[i].isupper()):
                    a_lines.append(lines[i])
                    i += 1
                answer = "\n\n".join(" ".join(chunk.split()) for chunk in "\n".join(a_lines).split('\n\n'))
                out.append(f"> **A:** {answer}\n")
            continue

        out.append(line + "\n")
        i += 1

    return "\n".join(out)

def main():
    import time
    t0 = time.time()
    verbose = '--verbose' in sys.argv or '-v' in sys.argv or '--debug' in sys.argv
    debug = '--debug' in sys.argv

    def log(msg: str):
        print(f"[build-rules] {msg}", flush=True)

    def log_debug(msg: str):
        if debug:
            print(f"[build-rules:debug] {msg}", flush=True)

    log("Starting Rules Reference v1.8 extraction and formatting...")

    pdf_path = os.path.join('references', 'mc_rulesreference_v18_compressed.pdf')
    log(f"[1/6] Loading PDF: {pdf_path}")
    reader = pypdf.PdfReader(pdf_path)
    pages = [clean_text(p.extract_text()) for p in reader.pages]
    log(f"[1/6] Successfully extracted {len(pages)} pages.")

    # 1. Front matter & Appendices
    p1_changes = pages[0].strip()
    p4_overview = pages[3][:pages[3].find('ABILITY')].strip()
    app1 = pages[49].strip()
    app2 = pages[50].strip()
    app3 = "\n\n".join(pages[51:56]).strip()

    p65 = pages[64]
    errata_split = p65.find('APPENDIX V:')
    if errata_split == -1:
        errata_split = p65.find('ERRATA')
    faq_end = p65[:errata_split].strip()
    errata_start = p65[errata_split:].strip()

    app4 = "\n\n".join(pages[56:64]) + "\n\n" + faq_end
    app5 = errata_start + "\n\n" + "\n\n".join(pages[65:70])
    app6 = pages[70].strip()

    # 2. Extract Glossary Entries (Pages 4 to 49)
    p4 = pages[3]
    ability_idx = p4.find('ABILITY')
    glossary_full = p4[ability_idx:]
    for i in range(4, 49):
        glossary_full += "\n" + pages[i]

    lines = [l.strip() for l in glossary_full.splitlines()]

    entries: List[Tuple[str, str]] = []
    curr_title = None
    curr_body = []

    i = 0
    while i < len(lines):
        line = lines[i]
        if not line:
            if curr_body:
                curr_body.append("")
            i += 1
            continue

        clean_line = re.sub(r'\[[a-z\-]+\]', '', line)
        letters = [c for c in clean_line if c.isalpha()]
        is_upper = len(letters) >= 2 and all(c.isupper() for c in letters)
        is_bullet = line.startswith('-') or line.startswith('*')
        is_dash = ' — ' in line or ' – ' in line

        if is_upper and not is_bullet and not is_dash and line not in DIAGRAM_LINES:
            # Special multi-line heading check
            if line == 'PLAY RESTRICTIONS AND' and i + 1 < len(lines) and lines[i+1] == 'PERMISSIONS':
                line = 'PLAY RESTRICTIONS AND PERMISSIONS'
                i += 1

            # Filter diagram callouts that happen to be uppercase
            if line == 'ATTACHMENT' and (i > 0 and 'RHINO' in lines[i-1] or (i+1 < len(lines) and lines[i+1] == 'WEAPON.')):
                curr_body.append(line)
                i += 1
                continue
            if line == 'ATK' and (i > 0 and 'RHINO' in lines[i-1]):
                curr_body.append(line)
                i += 1
                continue

            if curr_title:
                joined_body = normalize_body_see_also("\n".join(curr_body).strip())
                entries.append((curr_title, joined_body))
            curr_title = line
            curr_body = []
        else:
            curr_body.append(line)
        i += 1

    if curr_title:
        joined_body = normalize_body_see_also("\n".join(curr_body).strip())
        entries.append((curr_title, joined_body))

    log(f"[2/6] Extracted {len(entries)} glossary entries.")

    # 3. Build Entry Lookup Table & Letter Partition
    entry_by_letter: Dict[str, List[Tuple[str, str, str]]] = {}
    term_to_info: Dict[str, Dict[str, Any]] = {}

    for title, body in entries:
        letter = get_letter_group(title)
        anchor = make_anchor(title)
        entry_by_letter.setdefault(letter, []).append((title, anchor, body))

        # Extract "See also:" terms
        see_also = []
        for line in body.splitlines():
            m = re.search(r'See(?:\s+also)?\s*:\s*(.*)', line, re.IGNORECASE)
            if m:
                raw_refs = m.group(1).split(',')
                for ref in raw_refs:
                    ref_clean = re.sub(r'[\.\;]', '', ref).strip()
                    if ref_clean:
                        see_also.append(ref_clean)

        term_to_info[anchor] = {
            'title': title,
            'anchor': anchor,
            'letter': letter,
            'body': body,
            'see_also': see_also,
            'referenced_by': [],
            'faqs': []
        }

    # Normalize term search for cross-referencing
    norm_to_anchor = {}
    for anchor, info in term_to_info.items():
        norm_key = re.sub(r'[^a-z0-9]', '', info['title'].lower())
        norm_to_anchor[norm_key] = anchor
        anchor_norm = re.sub(r'[^a-z0-9]', '', anchor)
        norm_to_anchor[anchor_norm] = anchor

    # Add aliases if they exist
    aliases = {
        'stun': 'stun-stunned',
        'stunned': 'stun-stunned',
        'confuse': 'confuse-confused',
        'confused': 'confuse-confused',
        'tough': 'toughness',
        'toughness': 'toughness',
        'defend': 'defend-defense',
        'defense': 'defend-defense',
        'damage': 'damage',
        'attack': 'attack-player-ability-type',
        'thwart': 'thwart-player-ability-type',
        'cost': 'cost',
        'resource': 'resource',
        'ability': 'ability',
        'boost': 'boost-boost-icon',
        'acceleration': 'acceleration-token',
        'amplify': 'amplify-icon',
        'crisis': 'crisis-icon',
        'hazard': 'hazard-icon',
    }
    for alias_k, alias_v in aliases.items():
        if alias_v in term_to_info:
            norm_to_anchor[alias_k] = alias_v

    # Build bidirectional references
    for anchor, info in term_to_info.items():
        for ref in info['see_also']:
            ref_norm = re.sub(r'[^a-z0-9]', '', ref.lower())
            if ref_norm in norm_to_anchor:
                target_anchor = norm_to_anchor[ref_norm]
                if target_anchor in term_to_info:
                    if info['title'] not in term_to_info[target_anchor]['referenced_by']:
                        term_to_info[target_anchor]['referenced_by'].append(info['title'])

    # 4. Map FAQs to relevant terms
    faq_sections = app4.split('\n\n')
    current_faq_group = "General Questions"
    for sec in faq_sections:
        sec_s = sec.strip()
        if not sec_s:
            continue
        if sec_s.startswith('Q:'):
            q_lower = sec_s.lower()
            for norm_key, t_anchor in norm_to_anchor.items():
                if len(norm_key) >= 5 and norm_key in q_lower:
                    if t_anchor in term_to_info and len(term_to_info[t_anchor]['faqs']) < 5:
                        term_to_info[t_anchor]['faqs'].append({
                            'group': current_faq_group,
                            'question': sec_s.splitlines()[0]
                        })
        elif 'HERO PACK' in sec_s or 'SCENARIO PACK' in sec_s or 'GENERAL QUESTIONS' in sec_s:
            current_faq_group = sec_s.splitlines()[0].strip()

    # 5. Helper function to enrich body text with clickable Markdown links
    def linkify_see_also(body_text: str, current_letter: str) -> str:
        lines = body_text.splitlines()
        new_lines = []
        for line in lines:
            m = re.search(r'^(See(?:\s+also)?\s*:\s*)(.*)$', line, re.IGNORECASE)
            if m:
                prefix = m.group(1)
                refs_raw = m.group(2).split(',')
                linked_refs = []
                for r in refs_raw:
                    r_clean = r.strip().rstrip('.;')
                    r_norm = re.sub(r'[^a-z0-9]', '', r_clean.lower())
                    if r_norm in norm_to_anchor:
                        target_anchor = norm_to_anchor[r_norm]
                        target_info = term_to_info[target_anchor]
                        target_letter = target_info['letter']
                        if target_letter == current_letter:
                            linked_refs.append(f"[{r_clean}](#{target_anchor})")
                        else:
                            linked_refs.append(f"[{r_clean}]({target_letter}.md#{target_anchor})")
                    else:
                        linked_refs.append(r_clean)
                new_lines.append(f"*{prefix}* " + ", ".join(linked_refs))
            else:
                new_lines.append(line)
        return "\n".join(new_lines)

    # 6. Create directories
    os.makedirs(os.path.join('references', 'rules', 'glossary'), exist_ok=True)
    os.makedirs(os.path.join('references', 'rules', 'appendices'), exist_ok=True)

    # 7. Write Modular Glossary Files (A.md, B.md, ...)
    for letter in sorted(entry_by_letter.keys()):
        file_path = os.path.join('references', 'rules', 'glossary', f"{letter}.md")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(f"# Glossary: {letter}\n\n")
            f.write(f"[← Back to Master Rules Index](../README.md) | [Topic Map](../TOPIC_MAP.md)\n\n---\n\n")

            # Page navigation within letter
            items = entry_by_letter[letter]
            toc_links = [f"[{t}](#{a})" for t, a, _ in items]
            f.write(" • ".join(toc_links) + "\n\n---\n\n")

            for title, anchor, body in items:
                f.write(f"### {title}\n\n")
                linked_body = linkify_see_also(body, letter)
                f.write(linked_body + "\n\n")

                info = term_to_info[anchor]
                if info['referenced_by']:
                    ref_links = []
                    for r_title in info['referenced_by'][:8]:
                        r_norm = re.sub(r'[^a-z0-9]', '', r_title.lower())
                        if r_norm in norm_to_anchor:
                            r_anc = norm_to_anchor[r_norm]
                            r_let = term_to_info[r_anc]['letter']
                            if r_let == letter:
                                ref_links.append(f"[{r_title}](#{r_anc})")
                            else:
                                ref_links.append(f"[{r_title}]({r_let}.md#{r_anc})")
                        else:
                            ref_links.append(r_title)
                    f.write(f"*Referenced by:* {', '.join(ref_links)}\n\n")

                if info['faqs']:
                    f.write(f"*Related FAQ items:*\n")
                    for faq in info['faqs'][:3]:
                        f.write(f"- [{faq['group']}: {faq['question']}](../appendices/04_faq.md)\n")
                    f.write("\n")

                f.write("---\n\n")

    log(f"[3/6] Generated dependency graph with {len(term_to_info)} indexed terms.")
    log(f"[4/6] Wrote {len(entry_by_letter)} glossary letter files.")
    log("[5/6] Formatting Appendices (including structured Card Errata and FAQ)...")

    # 8. Write Appendices
    with open(os.path.join('references', 'rules', 'appendices', '00_overview_and_rules.md'), 'w', encoding='utf-8') as f:
        f.write("# Rules Reference v1.8: Overview & Core Principles\n\n")
        f.write("[← Back to Master Rules Index](../README.md)\n\n---\n\n")
        f.write("## Summary of Notable Changes in v1.8\n\n")
        f.write(p1_changes + "\n\n---\n\n")
        f.write("## Overview & The Golden Rules\n\n")
        f.write(p4_overview + "\n")

    with open(os.path.join('references', 'rules', 'appendices', '01_deck_customization.md'), 'w', encoding='utf-8') as f:
        f.write("# Appendix I: Deck Customization\n\n[← Back to Master Rules Index](../README.md)\n\n---\n\n")
        f.write(app1 + "\n")

    with open(os.path.join('references', 'rules', 'appendices', '02_setup.md'), 'w', encoding='utf-8') as f:
        f.write("# Appendix II: Setup\n\n[← Back to Master Rules Index](../README.md)\n\n---\n\n")
        f.write(app2 + "\n")

    with open(os.path.join('references', 'rules', 'appendices', '03_card_anatomy.md'), 'w', encoding='utf-8') as f:
        f.write("# Appendix III: Card Anatomy\n\n[← Back to Master Rules Index](../README.md)\n\n---\n\n")
        f.write(app3 + "\n")

    formatted_faq = format_faq(app4)
    formatted_errata = format_card_errata(app5)

    with open(os.path.join('references', 'rules', 'appendices', '04_faq.md'), 'w', encoding='utf-8') as f:
        f.write(formatted_faq + "\n")

    with open(os.path.join('references', 'rules', 'appendices', '05_card_errata.md'), 'w', encoding='utf-8') as f:
        f.write(formatted_errata + "\n")

    with open(os.path.join('references', 'rules', 'appendices', '06_game_environments.md'), 'w', encoding='utf-8') as f:
        f.write("# Appendix VI: Game Environments (Beta)\n\n[← Back to Master Rules Index](../README.md)\n\n---\n\n")
        f.write(app6 + "\n")

    print("Wrote appendices files.")

    # 9. Write TOPIC_MAP.md
    topic_map_content = """# Marvel Champions Rules Reference: Operational Topic Map

This document groups interconnected rules into **cross-cutting operational clusters**. 

> [!IMPORTANT]
> When implementing, auditing, or debugging any card or mechanic within a cluster, you must verify against **all** related entries in that cluster. Mechanics in Marvel Champions operate in interconnected systems.

---

## 1. Combat & Damage Operations
Governs attacks, basic powers, defense declarations, damage resolution, retaliate, and combat status effects.
* **Initiating Attacks:** [Attack (Enemy Activation)](glossary/A.md#attack-enemy-activation) • [Attack (Player Ability Type)](glossary/A.md#attack-player-ability-type) • [Attacks Against Allies](glossary/A.md#attacks-against-allies) • [Basic Power](glossary/B.md#basic-power)
* **Defending & Guarding:** [Defend, Defense](glossary/D.md#defend-defense) • [Guard](glossary/G.md#guard)
* **Damage Application:** [Damage](glossary/D.md#damage) • [Consequential Damage](glossary/C.md#consequential-damage) • [Indirect Damage](glossary/I.md#indirect-damage) • [Hit Points](glossary/H.md#hit-points) • [Defeat](glossary/D.md#defeat) • [Villain Defeat](glossary/V.md#villain-defeat)
* **Combat Keywords & Modifiers:** [Overkill](glossary/O.md#overkill) • [Piercing](glossary/P.md#piercing) • [Ranged](glossary/R.md#ranged) • [Retaliate](glossary/R.md#retaliate) • [Quickstrike](glossary/Q.md#quickstrike)
* **Combat Statuses:** [Stun, Stunned](glossary/S.md#stun-stunned) • [Toughness](glossary/T.md#toughness)

---

## 2. Timing, Triggers & Resolution Pipelines
Governs priority order, triggers, interrupts, responses, and condition evaluation.
* **Abilities & Priority:** [Ability](glossary/A.md#ability) • [Constant Ability](glossary/C.md#constant-ability) • [Triggered Ability](glossary/T.md#triggered-ability) • [Simultaneous Timing Priority](glossary/S.md#simultaneous-timing-priority)
* **Timing Windows:** [Action](glossary/A.md#action) • [Interrupt](glossary/I.md#interrupt) • [Forced Interrupt](glossary/F.md#forced-interrupt) • [Response](glossary/R.md#response) • [Forced Response](glossary/F.md#forced-response) • [When Revealed](glossary/W.md#when-revealed)
* **Execution & Nesting:** [Initiating Abilities](glossary/I.md#initiating-abilities) • [Nested Sequences](glossary/N.md#nested-sequences) • [“Then”](glossary/T.md#then) • [Delayed Effect](glossary/D.md#delayed-effect) • [Replacement Effect](glossary/R.md#replacement-effect) • [Cancel](glossary/C.md#cancel) • [Modifiers](glossary/M.md#modifiers)

---

## 3. Card Economy, Resources & Costs
Governs resource generation, paying costs, playing cards, and zone transitions.
* **Paying & Costs:** [Cost](glossary/C.md#cost) • [Cost Arrow Icon (→)](glossary/C.md#cost-arrow-icon-) • [Resource](glossary/R.md#resource) • [Resource Type](glossary/R.md#resource-type) • [Wild Resource](glossary/W.md#wild-resource)
* **Playing & Entering Play:** [Play, Play Costs](glossary/P.md#play-play-costs) • [Put Into Play](glossary/P.md#put-into-play) • [Play Restrictions and Permissions](glossary/P.md#play-restrictions-and-permissions) • [Enters Play](glossary/E.md#enters-play)
* **Zones & Transitions:** [Leaves Play](glossary/L.md#leaves-play) • [In Play and Out of Play](glossary/I.md#in-play-and-out-of-play) • [Discard, Discard Piles](glossary/D.md#discard-discard-piles) • [Hand Size](glossary/H.md#hand-size) • [Mulligan](glossary/M.md#mulligan)
* **Deck Limits & Uniqueness:** [Max, Maximum](glossary/M.md#max-maximum) • [Limit](glossary/L.md#limit) • [Unique, Unique Icon](glossary/U.md#unique-unique-icon) • [Permanent](glossary/P.md#permanent)

---

## 4. Schemes, Threat & Encounter Icons
Governs villain scheming, side schemes, threat placement/removal, and encounter icons.
* **Scheming:** [Scheme (Enemy Activation)](glossary/S.md#scheme-enemy-activation) • [Main Scheme](glossary/M.md#main-scheme) • [Side Scheme](glossary/S.md#side-scheme) • [Scheme (Card Type)](glossary/S.md#scheme-card-type)
* **Threat Management:** [Threat](glossary/T.md#threat) • [Thwart (Player Ability Type)](glossary/T.md#thwart-player-ability-type) • [Basic Thwart](glossary/B.md#basic-thwart) • [Assault](glossary/A.md#assault) • [Patrol](glossary/P.md#patrol) • [Crisis](glossary/C.md#crisis)
* **Encounter Icons:** [Acceleration Icon](glossary/A.md#acceleration-icon) • [Acceleration Token](glossary/A.md#acceleration-token) • [Amplify Icon](glossary/A.md#amplify-icon) • [Crisis Icon](glossary/C.md#crisis-icon) • [Hazard Icon](glossary/H.md#hazard-icon)
* **Scheme Status:** [Confuse, Confused](glossary/C.md#confuse-confused)

---

## 5. Round Structure, Phases & Turn Sequence
Governs steps of the Player Phase and Villain Phase.
* **Structure:** [Round Overview](appendices/00_overview_and_rules.md#round-overview) • [Player Turn](glossary/P.md#player-turn) • [Active Player](glossary/A.md#active-player) • [In Player Order](glossary/I.md#in-player-order) • [First Player](glossary/F.md#first-player)
* **Villain Phase Steps:** [Villain Phase](glossary/V.md#villain-phase) • [Activation](glossary/A.md#activation) • [Boost, Boost Icon](glossary/B.md#boost-boost-icon) • [Deal, Dealing Cards](glossary/D.md#deal-dealing-cards) • [Reveal](glossary/R.md#reveal) • [Surge](glossary/S.md#surge) • [Peril](glossary/P.md#peril)
* **Game End:** [Winning the Game](glossary/W.md#winning-the-game) • [Losing the Game](glossary/L.md#losing-the-game) • [Player Elimination](glossary/P.md#player-elimination)

---

## 6. Identity, Forms & Card Archetypes
Governs heroes, alter-egos, forms, and classifications.
* **Forms & States:** [Identity](glossary/I.md#identity) • [Hero, Hero Form](glossary/H.md#hero-hero-form) • [Alter-Ego, Alter-Ego Form](glossary/A.md#alter-ego-alter-ego-form) • [Form, Change Form](glossary/F.md#form-change-form)
* **Card Classifications:** [Aspect Card](glossary/A.md#aspect-card) • [Basic Card](glossary/B.md#basic-card) • [Identity-Specific Card](glossary/I.md#identity-specific-card) • [Obligation](glossary/O.md#obligation) • [Nemesis Set](glossary/N.md#nemesis-set)
* **Card Types:** [Card Types](glossary/C.md#card-types) • [Ally](glossary/A.md#ally) • [Event](glossary/E.md#event) • [Resource Card](glossary/R.md#resource-card) • [Support](glossary/S.md#support) • [Upgrade](glossary/U.md#upgrade) • [Attachment](glossary/A.md#attachment) • [Treachery](glossary/T.md#treachery) • [Environment](glossary/E.md#environment)
"""

    with open(os.path.join('references', 'rules', 'TOPIC_MAP.md'), 'w', encoding='utf-8') as f:
        f.write(topic_map_content)

    print("Wrote TOPIC_MAP.md.")

    # 10. Write README.md (Master Index)
    readme_content = """# Marvel Champions Digital (MCD) — Official Rules Reference v1.8

This directory contains the structured, modularized Markdown translation of the official Marvel Champions Rules Reference (v1.8).

> [!IMPORTANT]
> **Agent Policy:** All MCD agents must use this directory (`references/rules/`) for gameplay rules research, card translations, and engine verification. Agents must **not** load or view the raw PDF (`references/mc_rulesreference_v18_compressed.pdf`) unless confidence on an ambiguous reading is low (<95%) or explicitly requested by the user.

---

## Quick Navigation

* **[Topic Map (Cross-Cutting Operational Clusters)](TOPIC_MAP.md)** — **Start here** when investigating combat, timing pipelines, card economy, or scheme mechanics.
* **[Core Principles & Overview](appendices/00_overview_and_rules.md)** — The Golden Rules, The Grim Rule, Component Limitations, and Round Overview.
* **[Appendix I: Deck Customization](appendices/01_deck_customization.md)**
* **[Appendix II: Setup (16-Step)](appendices/02_setup.md)**
* **[Appendix III: Card Anatomy](appendices/03_card_anatomy.md)**
* **[Appendix IV: FAQ](appendices/04_faq.md)**
* **[Appendix V: Card Errata](appendices/05_card_errata.md)**
* **[Appendix VI: Game Environments (Beta)](appendices/06_game_environments.md)**

---

## Alphabetical Glossary Index

| Letter | Entries |
| :---: | :--- |
"""
    for letter in sorted(entry_by_letter.keys()):
        items = entry_by_letter[letter]
        links = [f"[{t}](glossary/{letter}.md#{a})" for t, a, _ in items]
        readme_content += f"| **[{letter}](glossary/{letter}.md)** | {', '.join(links)} |\n"

    readme_content += """
---

## Fast Terminal Rule Lookup
You can quickly retrieve any rule entry directly in PowerShell / terminal without loading large files:
```powershell
python scripts/lookup-rule.py "toughness"
```
Or via npm:
```bash
npm run rule -- "toughness"
```
"""
    with open(os.path.join('references', 'rules', 'README.md'), 'w', encoding='utf-8') as f:
        f.write(readme_content)

    log("Wrote references/rules/README.md.")

    # 11. Write Machine-Readable Graph rules_graph.json
    clean_graph = {}
    for anchor, info in term_to_info.items():
        clean_graph[anchor] = {
            'title': info['title'],
            'anchor': anchor,
            'file': f"glossary/{info['letter']}.md",
            'see_also': info['see_also'],
            'referenced_by': info['referenced_by'],
            'faqs': info['faqs']
        }
    with open(os.path.join('references', 'rules', 'rules_graph.json'), 'w', encoding='utf-8') as f:
        json.dump(clean_graph, f, indent=2)

    log("Wrote references/rules/rules_graph.json.")

    # 12. Write Monolithic Markdown File
    log("[6/6] Writing monolithic references/rules_reference_v18.md...")
    with open(os.path.join('references', 'rules_reference_v18.md'), 'w', encoding='utf-8') as f:
        f.write("# Marvel Champions: The Card Game — Rules Reference v1.8\n\n")
        f.write("> Unabridged reference translated from Fantasy Flight Games official Rules Reference v1.8.\n\n")
        f.write("## Table of Contents\n")
        f.write("- [Summary of Notable Changes](#summary-of-notable-changes)\n")
        f.write("- [Overview & Core Principles](#overview--core-principles)\n")
        f.write("- [Glossary](#glossary)\n")
        f.write("- [Appendix I: Deck Customization](#appendix-i-deck-customization)\n")
        f.write("- [Appendix II: Setup](#appendix-ii-setup)\n")
        f.write("- [Appendix III: Card Anatomy](#appendix-iii-card-anatomy)\n")
        f.write("- [Appendix IV: FAQ](#appendix-iv-faq)\n")
        f.write("- [Appendix V: Card Errata](#appendix-v-card-errata)\n")
        f.write("- [Appendix VI: Game Environments (Beta)](#appendix-vi-game-environments-beta)\n\n---\n\n")

        f.write("## Summary of Notable Changes\n\n" + p1_changes + "\n\n---\n\n")
        f.write("## Overview & Core Principles\n\n" + p4_overview + "\n\n---\n\n")

        f.write("## Glossary\n\n")
        for title, anchor, body in [(t, make_anchor(t), b) for t, b in entries]:
            f.write(f"### {title}\n\n")
            f.write(body + "\n\n---\n\n")

        f.write("## Appendix I: Deck Customization\n\n" + app1 + "\n\n---\n\n")
        f.write("## Appendix II: Setup\n\n" + app2 + "\n\n---\n\n")
        f.write("## Appendix III: Card Anatomy\n\n" + app3 + "\n\n---\n\n")
        f.write("## Appendix IV: FAQ\n\n" + formatted_faq.split('---', 1)[-1].strip() + "\n\n---\n\n")
        f.write("## Appendix V: Card Errata\n\n" + formatted_errata.split('---', 1)[-1].strip() + "\n\n---\n\n")
        f.write("## Appendix VI: Game Environments (Beta)\n\n" + app6 + "\n\n")

    log("Wrote references/rules_reference_v18.md.")
    log(f"All files successfully generated in {time.time() - t0:.2f}s!")

if __name__ == '__main__':
    main()
