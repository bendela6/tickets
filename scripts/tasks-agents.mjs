// What every agent working on the plans says it's doing, shown in the task viewer
// (http://127.0.0.1:4741): in the page's corner, and on the card of the item it works on.
// Run it by its absolute path from any worktree.
//
//   node scripts/tasks-agents.mjs say <name> <state> [--item <id>] [text…]
//       name   who: planner, builder, or a worker's own name (worker-tk-7, worker-gw-13)
//       state  listening | working | done | failed | abandoned | stopped
//       item   what it works on: TK-7, TK-7.2, TK/E4
//       text   what it's doing now, in a few words: "Writing the Sort type"
//   node scripts/tasks-agents.mjs clear <name>   Forgets an agent (the viewer's × does the same).
//   node scripts/tasks-agents.mjs list           Prints what each agent last said.
//
// A worker that says nothing for 30 minutes while working shows as "abandoned?"; say something
// at every step, and say done, failed or abandoned at the end.
import { VIEWER, tell } from './tasks-lib.mjs';

const usage = () => {
  console.error(
    'Usage: node scripts/tasks-agents.mjs say <name> <state> [--item <id>] [text…] | clear <name> | list',
  );
  process.exit(1);
};

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === 'say') {
    const [name, state, ...words] = rest;
    if (!name || !state) usage();
    const at = words.indexOf('--item');
    const item = at >= 0 ? words.splice(at, 2)[1] : undefined;
    const told = await tell({ name, state, item, text: words.join(' ') });
    console.log(`${told.name}: ${told.state}${told.item ? ` on ${told.item}` : ''}`);
  } else if (command === 'clear') {
    if (!rest[0]) usage();
    await tell({ name: rest[0], state: 'clear' });
    console.log(`${rest[0]}: cleared`);
  } else if (command === 'list') {
    const agents = await (await fetch(`${VIEWER}/agents`)).json();
    for (const a of agents)
      console.log(
        `${a.name} (${a.role}): ${a.state}${a.item ? ` on ${a.item}` : ''}${a.text ? `: ${a.text}` : ''} · last word ${a.at}`,
      );
    if (!agents.length) console.log('No agent has said anything.');
  } else usage();
} catch (error) {
  console.error(`The viewer at ${VIEWER} didn't take it: ${error.message}`);
  process.exit(1);
}
