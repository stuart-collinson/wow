import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const root = process.env.CLAUDE_PLUGIN_ROOT;

function readGate(path) {
  const full = resolve(root, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

const codingStandards = readGate('gates/coding-standards.md');
const frontendPatterns = readGate('gates/frontend-patterns.md');
const backendPatterns = readGate('gates/backend-patterns.md');
const securityPatterns = readGate('gates/security-patterns.md');

const context = `
# Engineering Standards — Active for this session

These rules apply to every response in this session without exception.

## Orchestration
- Frontend task: apply coding-standards + frontend-patterns + security-patterns
- Backend task: apply coding-standards + backend-patterns + security-patterns
- Touches both: apply all gates below
- Specialist audits (security reviews, etc.) can be delegated to agents in agents/

## Coding Standards (all tasks)
${codingStandards}

## Frontend Patterns (frontend tasks)
${frontendPatterns}

## Backend Patterns (backend tasks)
${backendPatterns}

## Security Patterns (all tasks)
${securityPatterns}
`;

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: context,
  },
}));
