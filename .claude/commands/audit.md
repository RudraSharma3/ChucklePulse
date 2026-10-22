---
description: Perform comprehensive security, test falsification, and architecture review
---

Assume the **Security Reviewer** (`.ai-os/prompts/security-reviewer.md` or `prompts/security-reviewer.md`) and **Tester** (`.ai-os/prompts/tester.md` or `prompts/tester.md`) roles.
1. Scan git diff for hardcoded credentials, unvalidated inputs, and injection vectors.
2. Review automated test coverage and attempt to falsify recent changes with edge cases.
3. Output a priority-ranked review report: [CRITICAL], [HIGH], [MEDIUM], [SUGGESTION], [VERIFIED].
