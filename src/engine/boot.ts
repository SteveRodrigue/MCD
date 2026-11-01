/**
 * Engine boot (ADR-0088): loads every module that binds a kernel entry or registers itself, so
 * `kernel.<entry>(...)` and the special-handler registry are complete before the first game
 * action. Imported by `engine/index.ts`, the UI and script entry points reach it through that
 * barrel, and `tests/setup/boot-kernel.ts` loads it for tests that import single modules.
 *
 * Nothing the boot loads imports it back, so it adds no cycle.
 */
import './effects';
import './effects/target-choice';
import './effects/handlers';
import './effects/dynamic-formula-evaluator';
import './triggers/trigger-dispatcher';
import './pipeline/prompt-queue';
import './pipeline/villain-phase';
import './pipeline/combat-pipeline';
import './pipeline/threat-pipeline';
import './pipeline/obligations';
import './pipeline/scenario-helpers';
import './pipeline/damage-pipeline';
import './pipeline/action-dispatcher';
import './pipeline/step-gate-evaluator';
import './scenarios';
