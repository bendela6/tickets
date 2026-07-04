import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { count, eq } from 'drizzle-orm';
import { createDbClient } from '../client';
import {
  comments,
  fieldOptions,
  linkTypes,
  projects,
  ticketEvents,
  ticketLinks,
  tickets,
  ticketValues,
} from '../schema';
import { ensureUser } from '../seed/ensure-user';
import { seedProject } from '../seed/seed-project';

// One-shot import of the items-core file-based tracker. Source layout:
// tasks/tasks.json + tasks/details/task-0XX.md.
const tasksDir = resolve(process.cwd(), process.argv[2] ?? '../../../items-core/tasks');
if (!existsSync(join(tasksDir, 'tasks.json'))) {
  console.error(`no tasks.json under ${tasksDir} — pass the tasks directory as an argument`);
  process.exit(1);
}

type SourceComment = { at: string; by: string; text: string };
type SourceSubtask = { id: number; title: string; status: string; note?: string };
type SourceTask = {
  id: string;
  title: string;
  epic?: string;
  severity: 'high' | 'medium' | 'low';
  status: string;
  area?: string;
  file: string;
  comments?: SourceComment[];
  dependsOn?: string[];
  subtasks?: SourceSubtask[];
};
type SourcePayload = { tasks: SourceTask[] };

const payload = JSON.parse(readFileSync(join(tasksDir, 'tasks.json'), 'utf8')) as SourcePayload;

const SUBTASK_STATUS_MAP: Record<string, string> = {
  todo: 'open',
  'in-progress': 'in-progress',
  blocked: 'blocked',
  done: 'fixed',
  skipped: 'dropped',
};

const EPIC_PALETTE = [
  //
  '#3987e5',
  '#8f7ae8',
  '#1ba394',
  '#d98324',
  '#d0679d',
  '#58a154',
  '#b0812c',
  '#7a8ba3',
];

const { db, sql } = createDbClient({ max: 1 });

const existingProject = await db.select().from(projects).where(eq(projects.key, 'items-core'));
if (existingProject.length > 0) {
  console.error('project "items-core" already exists — drop/recreate the database to re-import');
  await sql.end();
  process.exit(1);
}

const seeded = await seedProject(db, {
  key: 'items-core',
  name: 'items-core',
  ticketPrefix: 'TASK',
});
const { project, claudeUserId, typeByKey, statusByKey, fieldByKey, linkTypeByKey } = seeded;

const requireField = (key: string) => {
  const field = fieldByKey[key];
  if (!field) {
    throw new Error(`missing system field "${key}"`);
  }
  return field;
};
const requireStatus = (key: string) => {
  const status = statusByKey[key];
  if (!status) {
    throw new Error(`unknown status "${key}"`);
  }
  return status;
};

// epics become options on the epic field, hues assigned by first appearance
const epicNames = [...new Set(payload.tasks.map((task) => task.epic).filter(Boolean))] as string[];
const epicRows = await db
  .insert(fieldOptions)
  .values(
    epicNames.map((name, index) => {
      return {
        fieldId: requireField('epic').id,
        value: name,
        label: name,
        position: index,
        config: { color: EPIC_PALETTE[index % EPIC_PALETTE.length] },
      };
    }),
  )
  .returning();
const epicByName = Object.fromEntries(epicRows.map((row) => [row.value, row]));

const severityOptions = Object.fromEntries(seeded.severityOptions.map((row) => [row.value, row]));

// comment authors become users; agents stay attributable
const authorNames = [
  ...new Set(payload.tasks.flatMap((task) => (task.comments ?? []).map((c) => c.by))),
];
const userIdByName: Record<string, number> = {};
for (const name of authorNames) {
  userIdByName[name] = await ensureUser(db, {
    name,
    kind: name === 'claude' ? 'agent' : 'human',
  });
}

let importedComments = 0;
let importedChildren = 0;
let importedLinks = 0;
const ticketIdByTaskId: Record<string, number> = {};
let nextChildNumber = Math.max(...payload.tasks.map((task) => Number(task.id.slice(5)))) + 1;

for (const task of payload.tasks) {
  const detailPath = join(tasksDir, task.file);
  const description = existsSync(detailPath) ? readFileSync(detailPath, 'utf8') : '';

  await db.transaction(async (tx) => {
    const [ticket] = await tx
      .insert(tickets)
      .values({
        projectId: project.id,
        typeId: typeByKey['task']!.id,
        number: Number(task.id.slice(5)),
        createdBy: claudeUserId,
      })
      .returning();
    if (!ticket) {
      throw new Error(`insert failed for ${task.id}`);
    }
    ticketIdByTaskId[task.id] = ticket.id;

    const values = [
      { ticketId: ticket.id, fieldId: requireField('title').id, valueText: task.title },
      { ticketId: ticket.id, fieldId: requireField('description').id, valueText: description },
      {
        ticketId: ticket.id,
        fieldId: requireField('status').id,
        statusId: requireStatus(task.status).id,
      },
      {
        ticketId: ticket.id,
        fieldId: requireField('severity').id,
        optionId: severityOptions[task.severity]!.id,
      },
      ...(task.epic
        ? [
            {
              ticketId: ticket.id,
              fieldId: requireField('epic').id,
              optionId: epicByName[task.epic]!.id,
            },
          ]
        : []),
      ...(task.area
        ? [{ ticketId: ticket.id, fieldId: requireField('area').id, valueText: task.area }]
        : []),
    ];
    await tx.insert(ticketValues).values(values);
    await tx.insert(ticketEvents).values({
      ticketId: ticket.id,
      actorId: claudeUserId,
      kind: 'imported',
      payload: { source: task.id },
    });

    for (const comment of task.comments ?? []) {
      await tx.insert(comments).values({
        ticketId: ticket.id,
        authorId: userIdByName[comment.by]!,
        body: comment.text,
        createdAt: `${comment.at}T00:00:00Z`,
      });
      importedComments += 1;
    }

    for (const subtask of task.subtasks ?? []) {
      const [child] = await tx
        .insert(tickets)
        .values({
          projectId: project.id,
          typeId: typeByKey['subtask']!.id,
          parentId: ticket.id,
          number: nextChildNumber,
          createdBy: claudeUserId,
        })
        .returning();
      if (!child) {
        throw new Error(`child insert failed for ${task.id}/${subtask.id}`);
      }
      nextChildNumber += 1;
      const mappedStatus = SUBTASK_STATUS_MAP[subtask.status];
      if (!mappedStatus) {
        throw new Error(`unmapped subtask status "${subtask.status}" on ${task.id}`);
      }
      await tx.insert(ticketValues).values([
        { ticketId: child.id, fieldId: requireField('title').id, valueText: subtask.title },
        {
          ticketId: child.id,
          fieldId: requireField('status').id,
          statusId: requireStatus(mappedStatus).id,
        },
        ...(subtask.note
          ? [
              {
                ticketId: child.id,
                fieldId: requireField('description').id,
                valueText: subtask.note,
              },
            ]
          : []),
      ]);
      await tx.insert(ticketEvents).values({
        ticketId: child.id,
        actorId: claudeUserId,
        kind: 'imported',
        payload: { source: `${task.id}/subtask-${subtask.id}` },
      });
      importedChildren += 1;
    }
  });
}

// dependsOn becomes blocks links: the dependency blocks the dependent ticket
for (const task of payload.tasks) {
  for (const dependencyId of task.dependsOn ?? []) {
    const source = ticketIdByTaskId[dependencyId];
    const target = ticketIdByTaskId[task.id];
    if (!source || !target) {
      throw new Error(`dangling dependsOn ${task.id} -> ${dependencyId}`);
    }
    await db.insert(ticketLinks).values({
      linkTypeId: linkTypeByKey['blocks']!.id,
      sourceTicketId: source,
      targetTicketId: target,
    });
    importedLinks += 1;
  }
}

// verify counts against the source before declaring success
const expected = {
  tasks: payload.tasks.length,
  children: payload.tasks.reduce((sum, task) => sum + (task.subtasks?.length ?? 0), 0),
  comments: payload.tasks.reduce((sum, task) => sum + (task.comments?.length ?? 0), 0),
  links: payload.tasks.reduce((sum, task) => sum + (task.dependsOn?.length ?? 0), 0),
};
const [taskCount] = await db
  .select({ value: count() })
  .from(tickets)
  .where(eq(tickets.typeId, typeByKey['task']!.id));
const [childCount] = await db
  .select({ value: count() })
  .from(tickets)
  .where(eq(tickets.typeId, typeByKey['subtask']!.id));
const [commentCount] = await db.select({ value: count() }).from(comments);
const [linkCount] = await db
  .select({ value: count() })
  .from(ticketLinks)
  .where(eq(ticketLinks.linkTypeId, linkTypeByKey['blocks']!.id));

const actual = {
  tasks: taskCount?.value ?? 0,
  children: childCount?.value ?? 0,
  comments: commentCount?.value ?? 0,
  links: linkCount?.value ?? 0,
};
console.table({ expected, actual });

await sql.end();
const mismatched = (Object.keys(expected) as (keyof typeof expected)[]).filter(
  (key) => expected[key] !== actual[key],
);
if (mismatched.length > 0) {
  console.error(`count mismatch on: ${mismatched.join(', ')}`);
  process.exit(1);
}
console.log(
  `imported ${actual.tasks} tickets, ${actual.children} subtask children, ` +
    `${actual.comments} comments, ${actual.links} blocks links into project #${project.id}`,
);
