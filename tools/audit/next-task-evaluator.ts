import { execSync } from 'child_process';

export interface TaskCandidate {
  issueNumber: number;
  title: string;
  url: string;
  type: 'feature' | 'bug' | 'refactor' | 'documentation' | 'ui';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  impact: 'high' | 'medium' | 'low';
  subsystem: string;
  cardImpactCount: number;
  cardImpactDescription: string;
  milestoneAlignment: string;
  score: number;
  recommendedSkill: string;
  triggerPrompt: string;
  rationale: string;
}

export function evaluateNextTasks(): TaskCandidate[] {
  // 1. Fetch Open GitHub Issues
  let rawIssues: any[] = [];
  try {
    const out = execSync(
      'gh issue list --state open --limit 50 --json number,title,labels,body,url',
      { encoding: 'utf8' },
    );
    rawIssues = JSON.parse(out);
  } catch (e) {
    console.error('Failed to fetch live GitHub issues.');
    return [];
  }

  const candidates: TaskCandidate[] = [];

  for (const issue of rawIssues) {
    const num = issue.number;
    const title = issue.title;
    const labels = (issue.labels || []).map((l: any) => l.name);

    // Extract Priority & Impact
    let priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P2';
    if (labels.some((l: string) => l.includes('P0'))) priority = 'P0';
    else if (labels.some((l: string) => l.includes('P1'))) priority = 'P1';
    else if (labels.some((l: string) => l.includes('P2'))) priority = 'P2';
    else if (labels.some((l: string) => l.includes('P3'))) priority = 'P3';

    let impact: 'high' | 'medium' | 'low' = 'medium';
    if (labels.some((l: string) => l.includes('impact:high'))) impact = 'high';
    else if (labels.some((l: string) => l.includes('impact:medium'))) impact = 'medium';
    else if (labels.some((l: string) => l.includes('impact:low'))) impact = 'low';

    let subsystem = 'engine';
    if (labels.some((l: string) => l.includes('subsystem:ui'))) subsystem = 'ui';
    else if (labels.some((l: string) => l.includes('subsystem:data'))) subsystem = 'data';

    let type: 'feature' | 'bug' | 'refactor' | 'documentation' | 'ui' = 'feature';
    if (title.startsWith('fix(') || labels.includes('bug')) type = 'bug';
    else if (title.startsWith('refactor(')) type = 'refactor';
    else if (title.startsWith('docs(')) type = 'documentation';
    else if (title.startsWith('feat(ui') || subsystem === 'ui') type = 'ui';

    // 3. Compute Card ROI Count based on issue theme
    let cardCount = 0;
    let cardDesc = 'General engine capability';
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes('restricted') || num === 30) {
      cardCount = 43;
      cardDesc = `43 cards with Restricted keyword across all packs`;
    } else if (lowerTitle.includes('deck exhaustion') || num === 32) {
      cardCount = 100;
      cardDesc = `Core table invariant affecting all deck exhaustion & milling events`;
    } else if (/\bcounters?\b/i.test(lowerTitle) || num === 33) {
      cardCount = 120;
      cardDesc = `120+ cards utilizing named counters across all sets`;
    } else if (lowerTitle.includes('player side scheme') || num === 34) {
      cardCount = 35;
      cardDesc = `35 Player Side Scheme cards across expansion waves`;
    } else if (
      lowerTitle.includes('search_and_select') ||
      lowerTitle.includes('look') ||
      num === 10
    ) {
      cardCount = 28;
      cardDesc = `28 hero & support cards using search/look & choose mechanics`;
    } else if (
      lowerTitle.includes('wakanda forever') ||
      lowerTitle.includes('special') ||
      num === 18 ||
      num === 19 ||
      num === 20
    ) {
      cardCount = 6;
      cardDesc = `All Black Panther upgrade cards (Energy Daggers, Suit, Claws, Tactical)`;
    } else if (lowerTitle.includes('status') || lowerTitle.includes('stalwart') || num === 35) {
      cardCount = 45;
      cardDesc = `45+ villain & minion cards with Stalwart, Steady, or activation modifiers`;
    } else if (lowerTitle.includes('play_from_discard') || num === 25) {
      cardCount = 8;
      cardDesc = `Make the Call and ally recursion events`;
    } else if (lowerTitle.includes('unicity') || num === 31 || num === 3) {
      cardCount = 50;
      cardDesc = `All unique allies, personas, and hero identity collision checks`;
    } else if (lowerTitle.includes('formula') || num === 36 || num === 5) {
      cardCount = 15;
      cardDesc = `Cards with dynamic threat/damage scaling`;
    }

    // 4. Milestone Alignment Score (Gate 1: Rhino Release vs Post-Rhino Deferred)
    const postRhinoIssues = [33, 34, 35, 37];
    const isPostRhino = postRhinoIssues.includes(num);

    let milestoneAlignment = 'Gate 1: The Rhino Release (Active Focus)';
    let milestoneScore = 40;

    if (isPostRhino) {
      milestoneAlignment = 'Post-Rhino Release (Deferred to Gate 2/3/4)';
      milestoneScore = -30; // Deprioritize out-of-scope tasks
    } else if (
      priority === 'P0' ||
      num === 46 ||
      num === 45 ||
      num === 51 ||
      num === 52 ||
      num === 48 ||
      num === 49
    ) {
      milestoneAlignment = 'Gate 1: Rhino Release (P0/P1 Active Core Blocker)';
      milestoneScore = 40;
    } else if (
      num === 25 ||
      num === 24 ||
      num === 23 ||
      num === 26 ||
      num === 17 ||
      num === 14 ||
      num === 13 ||
      num === 12 ||
      num === 36 ||
      num === 50 ||
      num === 4
    ) {
      milestoneAlignment = 'Gate 1: Rhino Release (Core Polish)';
      milestoneScore = 35;
    }

    // 5. Priority Score (0 - 40)
    let priorityScore = 20;
    if (priority === 'P0') priorityScore = 40;
    else if (priority === 'P1') priorityScore = 30;
    else if (priority === 'P2') priorityScore = 20;
    else if (priority === 'P3') priorityScore = 10;

    // 6. Impact Score (0 - 10)
    let impactScore = 5;
    if (impact === 'high') impactScore = 10;
    else if (impact === 'medium') impactScore = 5;
    else if (impact === 'low') impactScore = 2;

    // 7. Card ROI Score (0 - 20)
    const cardScore = Math.min(20, Math.round(cardCount * 0.4));

    // Total Composite Score
    const totalScore = isPostRhino ? 10 : priorityScore + milestoneScore + impactScore + cardScore;

    // Determine Recommended Skill
    let recommendedSkill = 'feature-delivery';
    if (type === 'bug') recommendedSkill = 'bug-fix';

    const triggerPrompt = `${recommendedSkill}: ${title} (Issue #${num})`;

    let rationale = `Blocks active ${milestoneAlignment}. Delivers high architectural value unlocking ${cardDesc}.`;
    if (priority === 'P0')
      rationale = `CRITICAL BLOCKER. Must be resolved immediately to restore core engine pipelines.`;

    candidates.push({
      issueNumber: num,
      title,
      url: issue.url,
      type,
      priority,
      impact,
      subsystem,
      cardImpactCount: cardCount,
      cardImpactDescription: cardDesc,
      milestoneAlignment,
      score: totalScore,
      recommendedSkill,
      triggerPrompt,
      rationale,
    });
  }

  // Sort descending by score
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

const tasks = evaluateNextTasks();
console.log(`\n🎯 EVALUATED ${tasks.length} OPEN TASKS — TOP RECOMMENDATIONS:\n`);

tasks.slice(0, 5).forEach((t, index) => {
  const medal =
    index === 0
      ? '🥇 [TOP PICK]'
      : index === 1
        ? '🥈 [RUNNER-UP]'
        : index === 2
          ? '🥉 [HIGH VALUE]'
          : `[#${index + 1}]`;
  console.log(`================================================================================`);
  console.log(`${medal} Score: ${t.score} pts | Issue #${t.issueNumber}: "${t.title}"`);
  console.log(
    `   🏷️ [${t.priority}] [impact:${t.impact}] [${t.subsystem}] | Milestone: ${t.milestoneAlignment}`,
  );
  console.log(`   🃏 Card Impact: ${t.cardImpactDescription}`);
  console.log(`   💡 Rationale: ${t.rationale}`);
  console.log(`   🚀 Action Trigger: "${t.triggerPrompt}"`);
});
console.log(`================================================================================\n`);
