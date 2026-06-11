---
name: bun-default
description: Use bun for package install and build tasks
metadata:
  type: feedback
---

**Always use `bun install` / `bun add` instead of npm or yarn. Use `bun run` instead of `npm run`.**

Why: Bun is significantly faster for installation and build execution.

How to apply: When adding dependencies or running scripts, prefer bun commands. This applies throughout the project lifecycle.
