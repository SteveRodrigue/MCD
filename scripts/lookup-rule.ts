#!/usr/bin/env node
/**
 * CLI tool to lookup rules, definitions, cross-references, and related FAQs
 * from the Marvel Champions Rules Reference v1.8.
 *
 * Usage:
 *   npm run rule -- "toughness"
 *   npm run rule -- "attack"
 */
import fs from 'fs';
import path from 'path';
import {
  rulesGraph as graph,
  type RuleEntry,
  type RuleSlug,
} from '../src/engine/simulation/rules-graph';

function normalize(term: string): string {
  let s = term.toLowerCase();
  s = s.replace(/\[[a-z-]+\]/g, '');
  s = s.replace(/[^a-z0-9]/g, '');
  return s;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: npm run rule -- <rule_name>');
    process.exitCode = 1;
    return;
  }

  const query = args.join(' ').trim();
  const normQuery = normalize(query);

  const entries = Object.entries(graph) as [RuleSlug, RuleEntry][];

  // 1. Exact match by anchor or normalized title; otherwise first partial match.
  let bestKey: RuleSlug | null = null;
  const matches: RuleSlug[] = [];

  for (const [anchor, data] of entries) {
    const titleNorm = normalize(data.title);
    const anchorNorm = normalize(anchor);
    if (normQuery === titleNorm || normQuery === anchorNorm) {
      bestKey = anchor;
      break;
    } else if (normQuery.includes(titleNorm) || titleNorm.includes(normQuery)) {
      matches.push(anchor);
    }
  }

  if (!bestKey && matches.length > 0) {
    bestKey = matches[0];
  }

  if (!bestKey) {
    console.log(`No rule found matching '${query}'.`);
    // Suggest close matches
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const possible = entries
      .map(([, data]) => data.title)
      .filter((title) => words.some((w) => normalize(title).includes(w)));
    if (possible.length > 0) {
      console.log(`Did you mean one of these? ${possible.slice(0, 5).join(', ')}`);
    }
    process.exitCode = 1;
    return;
  }

  const entry = graph[bestKey];
  const fileRelPath = path.join('references', 'rules', entry.file);

  // Read body text from file
  let bodyText = '';
  if (fs.existsSync(fileRelPath)) {
    // Normalize line endings to match Python's universal-newline text mode.
    const content = fs.readFileSync(fileRelPath, 'utf8').replace(/\r\n?/g, '\n');
    // Find the section ### <title>
    const pattern = new RegExp(
      `### ${escapeRegExp(entry.title)}\\s*\\n([\\s\\S]*?)(?=\\n---\\n|$)`,
    );
    const m = pattern.exec(content);
    if (m) {
      bodyText = m[1].trim();
    }
  }

  const ruler = '='.repeat(80);
  console.log(ruler);
  console.log(`RULE: ${entry.title}`);
  console.log(`File: references/rules/${entry.file}#${entry.anchor}`);
  console.log(ruler);

  if (bodyText) {
    console.log(bodyText);
  } else {
    console.log(`(See full details in references/rules/${entry.file})`);
  }

  console.log('\n' + '-'.repeat(80));
  if (entry.see_also && entry.see_also.length > 0) {
    console.log(`See also: ${entry.see_also.join(', ')}`);
  }
  if (entry.referenced_by && entry.referenced_by.length > 0) {
    console.log(`Referenced by: ${entry.referenced_by.join(', ')}`);
  }

  if (entry.faqs && entry.faqs.length > 0) {
    console.log('\nRelated FAQ Items:');
    for (const faq of entry.faqs) {
      console.log(`  - [${faq.group}] ${faq.question}`);
    }
  }

  console.log(ruler);
}

main();
