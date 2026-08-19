let promptsPromise;

export function loadPrompts() {
  if (!promptsPromise) {
    promptsPromise = import('../../src/services/curatedPrompts.js').then((m) => m.SKILL_PROMPTS);
  }
  return promptsPromise;
}
