"""
CLI tool to lookup rules, definitions, cross-references, and related FAQs
from the Marvel Champions Rules Reference v1.8.

Usage:
    python scripts/lookup-rule.py "toughness"
    python scripts/lookup-rule.py "attack"
"""

import sys
import os
import re
import json

def normalize(term: str) -> str:
    s = term.lower()
    s = re.sub(r'\[[a-z\-]+\]', '', s)
    s = re.sub(r'[^a-z0-9]', '', s)
    return s

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/lookup-rule.py <rule_name>")
        sys.exit(1)

    query = " ".join(sys.argv[1:]).strip()
    norm_query = normalize(query)

    graph_path = os.path.join('references', 'rules', 'rules_graph.json')
    if not os.path.exists(graph_path):
        print(f"Error: {graph_path} not found. Run python tools/build_rules_markdown.py first.")
        sys.exit(1)

    with open(graph_path, 'r', encoding='utf-8') as f:
        graph = json.load(f)

    # 1. Exact match by anchor or normalized title
    best_key = None
    matches = []

    for anchor, data in graph.items():
        title_norm = normalize(data['title'])
        anchor_norm = normalize(anchor)
        if norm_query == title_norm or norm_query == anchor_norm:
            best_key = anchor
            break
        elif norm_query in title_norm or title_norm in norm_query:
            matches.append(anchor)

    if not best_key and matches:
        best_key = matches[0]

    if not best_key:
        print(f"No rule found matching '{query}'.")
        # Suggest close matches
        possible = [data['title'] for data in graph.values() if any(w in normalize(data['title']) for w in query.lower().split())]
        if possible:
            print(f"Did you mean one of these? {', '.join(possible[:5])}")
        sys.exit(1)

    entry = graph[best_key]
    file_rel_path = os.path.join('references', 'rules', entry['file'])

    # Read body text from file
    body_text = ""
    if os.path.exists(file_rel_path):
        with open(file_rel_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # Find the section ### <title>
            pattern = re.compile(rf'### {re.escape(entry["title"])}\s*\n(.*?)(?=\n---\n|\Z)', re.DOTALL)
            m = pattern.search(content)
            if m:
                body_text = m.group(1).strip()

    print("=" * 80)
    print(f"RULE: {entry['title']}")
    print(f"File: references/rules/{entry['file']}#{entry['anchor']}")
    print("=" * 80)

    if body_text:
        print(body_text)
    else:
        print(f"(See full details in references/rules/{entry['file']})")

    print("\n" + "-" * 80)
    if entry.get('see_also'):
        print(f"See also: {', '.join(entry['see_also'])}")
    if entry.get('referenced_by'):
        print(f"Referenced by: {', '.join(entry['referenced_by'])}")

    if entry.get('faqs'):
        print("\nRelated FAQ Items:")
        for faq in entry['faqs']:
            print(f"  - [{faq['group']}] {faq['question']}")

    print("=" * 80)

if __name__ == '__main__':
    main()
