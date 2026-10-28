---
name: building-the-plan
description: Use when running as the builder session — the one that watches tasks/*.json and builds what the user approved, by dispatching each build to a worker subagent and showing what every worker is doing in the task viewer (http://127.0.0.1:4741). Also use when asked to "start the builder" or "build what I approve".
---

# Building the plan

You are the **builder**: you watch `tasks/*.json` and build what the user approves. You are a **dispatcher**: you decide what's ready and hand every build to a **worker**, a subagent you start with the Agent tool in the background, **one worker per feature**. You never build yourself.

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
   - check its branch (`git branch` and `git status` in the repo's checkout), and the `statusNote` of its feature;
   - then either dispatch it again, picking up from its last commit, or say `abandoned` for it with why.
3. **Run `node scripts/tasks-builder.mjs ready`.** In chat, list what's ready, what's approved but waiting (and on what), and what you'll skip and why. Then dispatch.

## What to build

- **Ready**, as `tasks-builder.mjs ready` works it out: an item without children that is approved, neither done nor cancelled, not `byYou`, and whose `blockedBy` (its own and its parents') are all done.
- **A feature is the unit:** all of a feature's ready items go to one worker, never one worker per ticket.
- **Order:** `tickets.json` first, then the other files. Inside a file, follow the plan's order.
- **Skip an item, and say why, when:**
  - it depends on a question still open in its feature's `openChoices` (`ready` counts them as `openQuestions`; read them);
  - it needs something only the user has: a passkey, a login, a secret, or the gateway's bh page while there's no `GATEWAY_TOKEN` (see "Merging and releasing").
- **Merges, pushes, bh releases and bh-page updates are yours** (the user's yes, 2026-10-15): a "Release bh's next version" or "Update … on the bh page" ticket is built like any other, as "Merging and releasing" says.
- **An approved feature without a plan:** don't build it. Write its plan:
  - tickets numbered under it, in the file's format, every title starting with a verb, each with its `blockedBy`;
  - then set its status to Planned, and say in chat that the new tickets wait for the user's approval.
- **Approved but waiting** (on something not done) isn't built. `tasks-builder.mjs wait` wakes you when its blockers are done.

## Dispatching a worker

- **One worker per feature, and one feature per worker:**
  - the worker builds all the feature's ready tickets and subtickets, one after another in the plan's order, on the feature's branch;
  - never split a feature's tickets across workers, and never start a second worker on a feature whose worker is still running;
  - a ticket of that feature that becomes ready while its worker runs waits for it: when its notification comes, continue that worker with SendMessage (it keeps its context), or dispatch a new one for the feature that picks up from the branch;
  - branch `tk-7`, in the repo's own checkout: `../bh` for bh work, `tickets` for tickets work;
  - **never create a git worktree** (the user, 2026-10-17): no `git worktree add`, no Agent `isolation: "worktree"`, and no clone in its place;
  - dispatch only when that checkout is on main with nothing uncommitted the branch would touch; otherwise say so in chat and ask the user;
  - never commit on main itself;
  - never edit the bh copies under `packages/bh` in an app; bh work happens in `../bh`.
- **One worker per repo at a time**, since they share its checkout. Workers in different repos run in parallel. In tickets, the worker doesn't touch `tasks/*.json`, so your edits to them carry across its branch switches; commit them only while main is checked out.
- Before dispatching, set the feature's status to "In progress".
- Check `node scripts/tasks-agents.mjs list`: never dispatch a feature a worker is already on.
- **Pick each worker's model** with the Agent tool's `model`, the cheapest that can do the job well, since it's cheaper and faster (the user, 2026-10-15). Don't leave every worker on Opus.
  - `haiku`: mechanical work spelled out to the line, such as swapping a component at the call sites a ticket lists, deleting leftovers, a rename, checking a release's tag, a bh-page update call, or a merge with no conflict.
  - `sonnet`: most builds, such as a component, hook or route from a written plan, tests, docs pages, and a check in the browser.
  - `opus`: planning a feature from a design, a contract several packages share, a merge with conflicts, a failure to debug, and anything a cheaper worker failed at or got wrong.
  - A feature's worker takes the model its hardest ready item needs. Name the model in the dispatch line in chat, e.g. "worker-tk-24 (haiku)".
  - If a cheaper worker fails or its work needs redoing, dispatch the feature again one model up.

Give each worker the whole brief, since it knows nothing else:
- **Its name and items:** a name like `worker-tk-7`, named after the feature, and every ready item of the feature, in order: their text, their `blockedBy`, their notes (the user's and the planner's replies), and the feature's `chosen`.
- **Where:** the repo's checkout and the branch, and the repo's CLAUDE.md and skills. In tickets that is `running-the-stack`.
- **Checks:** typecheck, tests and build. A "Check in the browser" ticket is done in the browser, with screenshots.
- **Commits:** one per ticket, on its branch, a conventional commit scoped to the app, written as `~/.claude/CLAUDE.md` says: no ticket id.
- **Last, merge and push:** once its items are built and checked, it merges its branch into main and pushes, as "Merging and releasing" says.
- **Never:** force-push, push a branch whose checks fail, deploy any other way than that push, or edit `tasks/*.json`.
- **Saying what it does**, with the absolute path, since it may run in another repo:
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

Report in chat in two lines: what's built, where it went live (deployed, or the bh version), and what's waiting on the user (an approval, an answer, a `byYou` step).

## Merging and releasing

Finished work goes on main, never parked on a branch or a pull request, in every repo, though a push to tickets' or the gateway's main deploys and a push to bh's main releases.

- **The worker merges, on its branch in the repo's checkout:**
  1. `git fetch origin`, then `git merge origin/main`, resolving any conflict;
  2. the checks again, on the merged result: typecheck, tests and build;
  3. `git push origin HEAD:main`. If main moved meanwhile and the push is refused, go back to 1;
  4. `git switch main`, `git merge --ff-only origin/main`, then `git branch -d <branch>`.
  - A branch whose checks fail isn't pushed: the worker says `failed` with why, and switches back to main, leaving the branch.
- **After its report:**
  - check the checkout is back on main and level with origin/main. If it isn't, say so and leave it.
  - a push to tickets' main deploys tickets.bendelhome.cc within a minute (skill `running-the-stack`), and the gateway's deploys the gateway: check the deploy came up, and say so in the report.
- **Branches built earlier and never merged:**
  - dispatch a worker to merge each one whose built items are done and checked;
  - a branch named parked or wip, or holding work the user hasn't approved, stays: ask the user.
- **A bh release is a push to bh's main.**
  - The release workflow (`scripts/release.mjs --publish`) tags the next version from the commits since the last tag. A `fix:`, `feat:` or `!` commit touching `packages/` or `copy.json` makes one. Other commits wait for the next version.
  - A "Release bh's next version" ticket is done once a tag holds its feature's commits: check `git ls-remote --tags origin` in `../bh`, and put the version in the feature's `statusNote`.
- **An "Update <app> … on the bh page" ticket** goes through the gateway's API. Never copy bh into `packages/bh` by hand.
  - Call `POST https://gateway.bendelhome.cc/api/library/apps/<app>/updates` with `{"version": "0.4.1"}` and `Authorization: Bearer $GATEWAY_TOKEN`. `GET /api/library/apps` lists the apps' ids.
  - It commits `chore: bh <version>` to the app's main, which deploys it. Follow it with `GET …/updates/<number>` until it ends.
  - Without `GATEWAY_TOKEN` in the environment, the update is the user's: ask them to press Update on the page.

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
