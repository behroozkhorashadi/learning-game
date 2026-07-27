# Ideas

Backlog of ideas for this repo, each as its own markdown file so a future
Claude Code session can pick one up with enough context to start immediately
— no need to re-explain the idea from scratch in chat.

## Format

Each file is one idea, named `kebab-case-title.md`, with these sections:

- **Status** — `idea` (not started), `in-progress`, or `done`.
- **Summary** — one or two sentences: what this is and why it'd be worth doing.
- **Context** — background a fresh Claude session wouldn't otherwise have:
  why this came up, constraints, relevant prior discussion.
- **Scope** — what's in and explicitly what's out, so the work doesn't sprawl.
- **Starter instructions for Claude** — a self-contained prompt: exact files
  to read first, concrete steps, and open questions to raise with the user
  rather than guess at.

## Workflow

To pick one up, tell Claude: "look at `ideas/<file>.md` and do it" (or
`/loop` it, or just paste the file). When done, either delete the file or
flip Status to `done` and move it to `ideas/done/` — whichever the user
prefers at the time.
