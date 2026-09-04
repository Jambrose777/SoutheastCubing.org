#!/usr/bin/env node

// Blocks commits that reference a numbered story (e.g. the word "story"
// immediately followed by a number, optionally with a "#") in application
// code. The docs/stories/ files those numbers point at are gitignored/local-only,
// so a reference like that in a tracked file points at nothing for anyone else
// who clones the repo — see
// .github/instructions/coding-conventions.instructions.md. Run via lint-staged
// against staged files on every commit.

const fs = require('fs');

const STORY_REF_PATTERN = /\bstor(?:y|ies)\b[^\n]{0,20}#?\d{2,3}\b/i;

const files = process.argv.slice(2);
let hasViolation = false;

for (const file of files) {
  let contents;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch {
    // Skip files that can't be read as text (e.g. binary, deleted-but-staged).
    continue;
  }

  const lines = contents.split('\n');
  lines.forEach((line, index) => {
    if (STORY_REF_PATTERN.test(line)) {
      hasViolation = true;
      console.error(`${file}:${index + 1}: contains a story-number reference — ${line.trim()}`);
    }
  });
}

if (hasViolation) {
  console.error(
    '\nStory numbers must not be referenced in tracked files (docs/ and .github/ are ' +
      'gitignored, so the reference points at nothing for anyone else). Describe the ' +
      'actual reasoning inline instead.',
  );
  process.exit(1);
}
