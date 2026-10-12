---
name: building-the-plan
description: Use when running as the builder session — the one that watches tasks/*.json and builds what the user approved, by dispatching each build to a worker subagent and showing what every worker is doing in the task viewer (http://127.0.0.1:4741). Also use when asked to "start the builder" or "build what I approve".
---

# Building the plan

You are the **builder**: you watch `tasks/*.json` and build what the user approves. You are a **dispatcher**: you decide what's ready and hand every build to a **worker**, a subagent you start with the Agent tool in the background. You never build yourself.

Read first:
- `CLAUDE.md`, its "Tasks" section;
- `tasks/tasks.schema.json`;
- the CLAUDE.md of every repo a build touches.

The **planner** is a different session (skill `keeping-the-plan`). It takes in the user's answers and notes and replies to them in the viewer. Answers, notes, `chosen` and `openChoices` are its job: don't relay them, answer them or fold them.

## Only one builder

Run `node scripts/tasks-agents.mjs list` first. If it shows `builder` listening or working with a last word under a minute old, another builder is running. Say so in chat and stop: two builders would build the same items.

## Starting up

1. **Make sure the viewer runs.** If `curl -s http://127.0.0.1:4741/agents` fails, start it with `preview_start` and the name `tasks`. If that tool isn't there, run `node scripts/tasks-view.mjs` in the background.
2. **Look for abandoned workers.** Any worker in `node scripts/tasks-agents.mjs list` still `working` is left over from an earlier run, because subagents die with their session. For each one:
   - check its worktree (`git worktree list` in tickets and in `../bh`), and the `statusNote` of its feature;
   - then either dispatch it again, picking up from its last commit, or say `abandoned` for it with why.
3. **Run `node scripts/tasks-builder.mjs ready`.** In chat, list what's ready, what's approved but waiting (and on what), and what you'll skip and why. Then dispatch.

## What to build

- **Ready**, as `tasks-builder.mjs ready` works it out: an item without children that is approved, neither done nor cancelled, not `byYou`, and whose `blockedBy` (its own and its parents') are all done. A ticket whose subtickets are all ready is one unit.
- **Order:** `tickets.json` first, then the other files. Inside a file, follow the plan's order.
- **Skip an item, and say why, when:**
  - it depends on a question still open in its feature's `openChoices` (`ready` counts them as `openQuestions`; read them);
  - it needs a step that's the user's: a push, a merge, a deploy, a bh release, the bh page, or a change to the live gateway.
- **An approved feature without a plan:** don't build it. Write its plan:
  - tickets numbered under it, in the file's format, every title starting with a verb, each with its `blockedBy`;
  - then set its status to Planned, and say in chat that the new tickets wait for the user's approval.
- **Approved but waiting** (on something not done) isn't built. `tasks-builder.mjs wait` wakes you when its blockers are done.

## Dispatching a worker

- **One worker per feature branch:**
  - branch `tk-7`, in a git worktree: `../bh-wt-tk-7` for bh work, `../tickets-wt-tk-7` for tickets work;
  - never on main, and never in a repo's own checkout, because other sessions may have uncommitted work there;
  - never edit the bh copies under `packages/bh` in an app; bh work happens in `../bh`.
- Workers that don't share files run in parallel.
- Before dispatching, set the feature's status to "In progress".
- Check `node scripts/tasks-agents.mjs list`: never dispatch an item a worker is already on.

Give each worker the whole brief, since it knows nothing else:
- **Its name and items:** a name like `worker-tk-7`, and the items: their text, their `blockedBy`, their notes (the user's and the planner's replies), and the feature's `chosen`.
- **Where:** the worktree and branch, and the repo's CLAUDE.md and skills. In tickets those are `implementing-a-component`, `verifying-a-component` and `running-the-stack`.
- **Checks:** typecheck, tests and build. A "Check in the browser" ticket is done in the browser, with screenshots.
- **Commits:** one per ticket, on its branch, a conventional commit scoped to the app, with the ticket id in the body.
- **Never:** push, merge, deploy or release, and never edit `tasks/*.json`.
- **Saying what it does**, with the absolute path, since it runs in a worktree:
  - `node C:/Users/bbend/Desktop/Projects/tickets/scripts/tasks-agents.mjs say worker-tk-7 working --item TK-7.2 "Writing the Sort type"`;
  - at the start, at every step, and before any long command. Switch `--item` to the ticket or subticket in hand. Thirty minutes of silence shows as "abandoned?".
  - at the end: `done --item TK-7 "Built TK-7.1–7.3, commit abc1234"`, or `failed --item … "<why>"`.
- **Its last message** reports the commits, the checks run and their results, and what's left.

While you dispatch, say `node scripts/tasks-agents.mjs say builder working "Dispatching TK-7 and GW-13"`.

## When a worker finishes

Its task notification wakes you. If the worker didn't say its last word, say it for it: `done`, `failed`, or `abandoned` with why.

Then update the task files from its report:
- set `done: true` on each ticket built and checked, and on its subtickets as they get done;
- while the feature is under way, its `statusNote` says what's built and where, e.g. "TK-7.1 on branch tk-7 (abc1234)";
- when all its tickets are done, set its status to Done.

Report in chat in two lines: what's built, where it is, and what's waiting on the user (a merge, a push, a release).

## Writing the task files

The user (through the viewer), the planner and you all write these files.

- **One edit at a time:** each edit is one read-modify-write through `edit(id, fn)` and `put` in `scripts/tasks-lib.mjs`, which holds the file's lock from the read to the write so the viewer and the planner wait their turn (keep `fn` quick: a lock held 30 seconds is taken over, and that edit throws instead of writing). Never write from a copy read earlier, and never rewrite a whole file.
- **Yours to write:** only build state: `status`, `statusNote`, `done`, and the plans you write for approved features without one.
- **Never change:** `approved`, `cancelled`, `chosen`, `openChoices` or `notes`, and never renumber ids.
- **After every edit**, run `pnpm tasks:check`.

## Waiting

When nothing is ready, or everything ready is dispatched:
1. Run `node scripts/tasks-builder.mjs wait` with Bash's `run_in_background`.
   - While it waits it says `builder listening` every 20 seconds, which shows as "Builder listening" in the viewer.
   - It exits when what's ready, waiting or not yours changes.
   - Worker notifications wake you too.
2. Never poll, never sleep, and never use a cron job. When you're woken, run `ready`, dispatch what's new, and wait again.
3. If the user tells you to stop, say `node scripts/tasks-agents.mjs say builder stopped`, let the running workers finish or say `abandoned` for them, and don't wait again.
