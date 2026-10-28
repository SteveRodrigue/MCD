import graph from '../../../references/rules/rules_graph.json';

export interface RuleFaq {
  group: string;
  question: string;
}

export interface RuleEntry {
  title: string;
  file: string;
  anchor: string;
  see_also?: string[];
  referenced_by?: string[];
  faqs?: RuleFaq[];
}

/** The slug of every Rules Reference v1.8 glossary entry; a new glossary entry changes this union. */
export type RuleSlug = keyof typeof graph;

/** The Rules Reference v1.8 glossary graph, keyed by rule slug (built by `tools/build_rules_markdown.py`). */
export type RulesGraph = Record<RuleSlug, RuleEntry>;

export const rulesGraph: RulesGraph = graph;
