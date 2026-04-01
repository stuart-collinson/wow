---
name: commit
description: Commit staged changes following Conventional Commits specification
disable-model-invocation: true
allowed-tools: Bash(git *)
---

# Commit Staged Changes

Automatically commit staged changes following the Conventional Commits specification.

## Instructions

1. First, run `git diff --cached` to see what changes are staged
2. If there are no staged changes, inform the user and stop
3. Analyze the staged changes and determine the appropriate commit type:
   - **feat**: A new feature
   - **fix**: A bug fix
   - **docs**: Documentation only changes
   - **style**: Changes that do not affect the meaning of the code (white-space, formatting,
etc.)
   - **refactor**: A code change that neither fixes a bug nor adds a feature
   - **perf**: A code change that improves performance
   - **test**: Adding missing tests or correcting existing tests
   - **build**: Changes that affect the build system or external dependencies
   - **ci**: Changes to CI configuration files and scripts
   - **chore**: Other changes that don't modify src or test files

4. Generate a commit message following this format:
   [optional scope]:

   [optional body]

5. The description should:
- Be written in imperative mood ("add feature" not "added feature")
- Not capitalize the first letter
- Not end with a period
- Be concise but descriptive (under 72 characters)
- Add a body only if the changes are complex and need more explanation

6. If there are breaking changes, add exclamation mark after the type/scope, like `feat!:` or
`feat(scope)!:`

7. **IMPORTANT**: Do NOT add any AI attribution, Claude Code references, or co-author tags. The
commit message should look like a normal human-written commit.

8. Create the commit using:
```bash
git commit -m "$(cat <<'EOF'
<your commit message here>
EOF
)"

9. After committing, run git status to confirm the commit was successful
