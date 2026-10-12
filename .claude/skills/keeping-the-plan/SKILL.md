---
name: keeping-the-plan
description: Use when running as the planner session — the one that listens to what the user says in the task viewer (http://127.0.0.1:4741), folds their answers into tasks/*.json, and replies to their notes and questions there, never in chat. Also use when asked to "listen to my answers" or "start the planner".
---

# Keeping the plan

You are the **planner**: you keep the plans in `tasks/*.json` in step with what the user says in the viewer, and you answer them **in the viewer, never in chat**. The user doesn't read this session's chat. Everything you have to say goes into the files as a reply note or a question, and the viewer shows it within two seconds.

Read `CLAUDE.md` (its "Tasks" section) and `tasks/tasks.schema.json` first. They define the shape, the ids and the titles.

The **builder** is a different session ("Task list builder"). It builds the items the user approved and marks them done. You never build, never set `approved` or `done`, never commit or push, and never write an `answer`.

## Only one planner

First run `curl -s http://127.0.0.1:4741/planner`. If it shows the planner listening or working with an `at` under a minute old, another planner is running. Say so in chat and stop: two planners would fold the same answers.

## The loop

1. **Make sure the viewer runs.** If `curl -s http://127.0.0.1:4741/planner` fails, start it with `preview_start` and the name `tasks`. If that tool isn't there, run `node scripts/tasks-view.mjs` in the background.
2. **Arm the wait.** Run `node scripts/tasks-planner.mjs wait` with Bash's `run_in_background`. While it waits it tells the viewer you're listening (the green "Planner listening" badge). It exits once the user has said something you haven't taken in yet and has left it alone for 15 seconds. You are woken when it exits. Never poll, never sleep, and never use a loop or a cron job: the background wait is the only clock.
3. **End the turn** with one line in chat, for the log.
4. **When the wait exits**, its output lists the words to take in, as JSON:
   - `{kind: "answer", file, id, index, question, answer, picked}`: an answered question. `picked` is the index of the chosen option, or null for the user's own words.
   - `{kind: "note", file, id, title, at, text}`: one of the user's notes you haven't read. An epic's id looks like `TK/E4`.

   The badge already says "Planner working". Update it as you go with `node scripts/tasks-planner.mjs say working "Folding TK-11's answers"`.
5. **Take in every item** (see below). Then run `pnpm tasks:check` and fix whatever it reports.
6. **Re-arm** (step 2). If an item you were given is still unresolved, the wait returns at once. Resolve each one: fold it, reply to it, or mark it read.

If the user tells you in chat to stop, run `node scripts/tasks-planner.mjs say stopped` and don't re-arm.

## Taking in an answer

First decide what kind of answer it is.

### A decision: fold it into the plan

This covers a picked option, or the user's own words that decide something (for example "skip/take default, cursor as an option").

- **`chosen`.** Add one whole sentence to the feature's `chosen` saying what's decided, ending with "(your answer)". When the user wrote their own words, quote them. Set `chosenOn` to today.
- **The plan.** Carry the decision everywhere it lands:
  - the feature's description;
  - the tickets' descriptions and types;
  - other features that build on it (search all of `tasks/*.json` for the ids and terms).
- **New and dropped tickets.**
  - A new ticket takes the next number under its parent. Its title starts with a verb. It gets `done: false` and a `blockedBy` entry, with a why, for each thing it waits on.
  - A ticket the decision makes unneeded gets `cancelled: true`. Its description gets "Cancelled on <date>: <why>". Ids never change, and nothing is deleted.
- **Remove the question** from `openChoices`, and drop the key once it's empty. When a feature has no question left, take "your choices (below)" out of `waitingOn`, and drop the key once it's empty.
- **Approved tickets.** If the user already approved a ticket the fold changed in substance, leave `approved` alone. Add a reply note on that ticket saying what changed since they approved it.
- **Say what you did.** Add one reply note on the feature listing what you folded and where it went (ids, each with what it is).

### A question, an objection, or unclear: reply instead of folding

- Move the answer into the question's `notes` as the user's note: `{at: now(), text: <their answer>, seen: now()}`. Then add your reply with `reply(text)`.
- Make the question better:
  - put what you explained into `context` when it stays true;
  - add their idea as an option when it is one;
  - keep `recommended` honest.

  Then clear `answer` and `answeredOn`. The question goes back to "to answer".
- **Unsure whether it's a decision?** Reply with how you read it, add that reading as an option, and let them pick it. Never decide for them.

## Taking in a note

Read it as the user's words about that item. A note with a `quote` (and maybe `nth`, which occurrence) is about that fragment of the item's description, which the viewer marks. Reply with `reply(text, note)`, passing the note you answer: the reply then carries the same quote, shown with it. The user reads your notes as a chat with you, in a panel beside the page: one chat per feature, holding its tickets' notes too, each tagged with its ticket's id. Reply on the item the note is on (`reply` does), and write as chat replies, short and direct.

Then do one of the following:

- **It asks something:** reply with a note on the same item.
- **It asks for a change to the plan:** make the change, then reply saying what changed (ids).
- **It raises a decision:** add a question to the feature's `openChoices`, then reply pointing at it.
  - The question names its subject, so it reads on its own.
  - It has at least 2 whole options and a `recommended` one.
  - Its `context` gives the pros and cons briefly.
- **It's an instruction for building:** the builder reads notes before it builds. Mark it read, and reply only if something is unclear.

In every case, set `seen: now()` on the note. That marks it read, and the viewer shows "Read by the planner".

## Writing the files

The user (through the viewer), the builder and you all write these files. Each edit is one read-modify-write that happens at once, through `scripts/tasks-lib.mjs`:

```js
// a script in your scratchpad; import the lib by its absolute file URL
import { edit, put, reply, now } from 'file:///C:/Users/bbend/Desktop/Projects/tickets/scripts/tasks-lib.mjs';

await edit('TK-11', (feature) => {
  const i = feature.openChoices?.findIndex((c) => c.question === QUESTION) ?? -1;
  // what you decided on must still be there, as the wait printed it
  if (i < 0 || feature.openChoices[i].answer !== ANSWER) return false;
  // …fold…
  feature.notes = [...(feature.notes ?? []), reply('Folded your answer …')];
});
```

- `edit` reads the file that holds the id, calls your function, and writes the file back through prettier, unless the function returns `false`. It handles epics (`'TK/E4'`), features, tickets and subtickets. It holds the file's lock (`tasks/.runtime/<file>.lock`) from the read to the write, so the viewer and the builder wait their turn; keep your function quick, since a lock held 30 seconds is taken over and that edit then throws instead of writing.
- `reply(text, note?)` makes your note (`by: "claude"`); given the note it answers, it keeps that note's `quote`.
- `put(item, fields)` sets keys in the schema's order. Setting a key to `undefined` removes it.
- Check inside `edit` that what you're acting on is unchanged. If the user changed it meanwhile, skip it: the next wait brings it back.
- Never write a file from a copy read earlier, and never rewrite a whole file.
- Write each script with the Write tool and run it with `node`. Heredocs break on the quotes and backticks these texts are full of.

## How to write to the user

Everything you write in the files is read in the viewer, so it must stand on its own:

- Name the subject. Define a term before using it. Give an id together with what it is: "TK-11.2, the query".
- Be short: a reply is a few sentences in plain words.
- Format for reading, never a wall of text. The viewer renders paragraphs (a blank line between), `- ` and `1. ` lists (nested by two spaces), **bold**, `code`, links and ids; headings don't render.
  - A question's `context`: one or two sentences on what's at stake, then one `- ` item per option or candidate, its name in **bold** first, then what it is, then "For:" and "Against:" as nested items.
  - A reply that compares or lists things does the same; a short answer stays a paragraph.
- A question is whole, its options are whole, one option is recommended, and its context weighs them.
- Never move an unanswered question into `chosen`, and never answer one yourself.
