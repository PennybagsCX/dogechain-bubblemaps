# AGENTS.md — Dogechain Bubblemaps

## Superpowers Plugin (MANDATORY)

**Always use the @superpowers plugin for all work on this project.** This is non-negotiable.

Before responding to ANY user request — including questions, code changes, bug fixes, feature work, reviews, and planning — check if a Superpowers skill applies. Even a 1% chance of relevance means you must invoke the skill first.

### Required Skill Usage

| Task Type                                | Superpowers Skill                                              | When                             |
| ---------------------------------------- | -------------------------------------------------------------- | -------------------------------- |
| Any creative/feature work                | `brainstorming`                                                | Before writing any code          |
| Bug / test failure / unexpected behavior | `systematic-debugging`                                         | Before proposing any fix         |
| Feature implementation                   | `test-driven-development`                                      | Before implementation code       |
| Multi-step task                          | `writing-plans`                                                | Before starting work             |
| Executing a plan                         | `executing-plans`                                              | During implementation            |
| Parallel independent tasks               | `dispatching-parallel-agents` or `subagent-driven-development` | When tasks can run independently |
| Completing work                          | `verification-before-completion`                               | Before claiming done             |
| Finished implementation                  | `finishing-a-development-branch`                               | Before merging/PR                |
| Code review requested                    | `requesting-code-review`                                       | Before asking for review         |
| Code review received                     | `receiving-code-review`                                        | Before implementing feedback     |
| Git isolation needed                     | `using-git-worktrees`                                          | Before feature work              |
| Creating new skills                      | `writing-skills`                                               | When authoring skills            |

### Rules

1. **Skill check comes BEFORE any response** — including clarifying questions.
2. **Process skills first** (brainstorming, debugging), then implementation skills.
3. **Follow the skill exactly** — especially rigid ones like TDD and debugging.
4. **User instructions in this file always override defaults**, but Superpowers skills override default system behavior.
5. If a skill says to do something and you're unsure, follow the skill.

## Project Info

- **Stack**: React + TypeScript + Vite + D3 + RainbowKit + wagmi
- **Network**: Dogechain
- **Port**: Dynamic via `PORT` env var (default 3000)
