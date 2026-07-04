import type { Db } from '../client';
import {
  fieldOptions,
  fields,
  linkTypes,
  projects,
  statuses,
  ticketTypeFields,
  ticketTypes,
  views,
} from '../schema';
import { ensureUser } from './ensure-user';

const KIND_COLORS: Record<string, string> = {
  todo: '#3987e5',
  active: '#8f7ae8',
  blocked: '#d03b3b',
  done: '#0ca30c',
  dropped: '#898781',
};

const STATUS_SEED = [
  ['open', 'Open', 'todo', 'Triaged into the backlog, not started'],
  ['investigating', 'Investigating', 'active', 'Root-causing / research underway'],
  ['investigated', 'Investigated', 'todo', 'Cause understood, ready to pick up'],
  ['brainstorming', 'Brainstorming', 'active', 'Exploring requirements and approaches'],
  ['designing', 'Designing', 'active', 'Writing the spec / design'],
  ['in-progress', 'In progress', 'active', 'Implementation underway'],
  ['review', 'Review', 'active', 'In code review / verification'],
  ['blocked', 'Blocked', 'blocked', 'Waiting on something else'],
  ['fixed', 'Fixed', 'done', 'Done and verified'],
  ['dropped', 'Dropped', 'dropped', 'Deliberately not doing'],
] as const;

const SEVERITY_SEED = [
  ['high', 'High', '#d03b3b'],
  ['medium', 'Medium', '#fab219'],
  ['low', 'Low', '#898781'],
] as const;

const LINK_TYPE_SEED = [
  ['blocks', 'blocks', 'is blocked by', true],
  ['relates-to', 'relates to', 'relates to', false],
  ['duplicates', 'duplicates', 'is duplicated by', true],
] as const;

export async function seedProject(
  db: Db,
  input: { key: string; name: string; ticketPrefix: string },
) {
  const claudeUserId = await ensureUser(db, { name: 'claude', kind: 'agent' });

  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({ key: input.key, name: input.name, ticketPrefix: input.ticketPrefix })
      .returning();
    if (!project) {
      throw new Error('project insert returned no row');
    }

    const insertedTypes = await tx
      .insert(ticketTypes)
      .values([
        {
          projectId: project.id,
          key: 'task',
          label: 'Task',
          position: 0,
          config: { color: '#3987e5' },
        },
        {
          projectId: project.id,
          key: 'subtask',
          label: 'Subtask',
          position: 1,
          config: { color: '#898781' },
        },
      ])
      .returning();
    const typeByKey = Object.fromEntries(insertedTypes.map((row) => [row.key, row]));

    const insertedStatuses = await tx
      .insert(statuses)
      .values(
        STATUS_SEED.map(([key, label, kind, description], position) => {
          return {
            projectId: project.id,
            key,
            label,
            kind,
            position,
            config: {
              color: KIND_COLORS[kind],
              description,
              ...(key === 'open' ? { initial: true } : {}),
            },
          };
        }),
      )
      .returning();
    const statusByKey = Object.fromEntries(insertedStatuses.map((row) => [row.key, row]));

    const insertedFields = await tx
      .insert(fields)
      .values([
        {
          projectId: project.id,
          key: 'title',
          label: 'Title',
          type: 'text',
          system: true,
          config: { widget: 'input' },
        },
        {
          projectId: project.id,
          key: 'description',
          label: 'Description',
          type: 'text',
          system: true,
          config: { widget: 'markdown' },
        },
        {
          projectId: project.id,
          key: 'status',
          label: 'Status',
          type: 'status',
          system: true,
          config: {},
        },
        {
          projectId: project.id,
          key: 'severity',
          label: 'Severity',
          type: 'select',
          system: true,
          config: {},
        },
        {
          projectId: project.id,
          key: 'epic',
          label: 'Epic',
          type: 'select',
          system: true,
          config: {},
        },
        {
          projectId: project.id,
          key: 'area',
          label: 'Area',
          type: 'text',
          system: true,
          config: { widget: 'input' },
        },
      ])
      .returning();
    const fieldByKey = Object.fromEntries(insertedFields.map((row) => [row.key, row]));
    const requireField = (key: string) => {
      const field = fieldByKey[key];
      if (!field) {
        throw new Error(`seed produced no "${key}" field`);
      }
      return field;
    };

    const taskFieldKeys = ['title', 'description', 'status', 'severity', 'epic', 'area'];
    const subtaskFieldKeys = ['title', 'status', 'description'];
    await tx.insert(ticketTypeFields).values([
      ...taskFieldKeys.map((key, position) => {
        return {
          ticketTypeId: typeByKey['task']!.id,
          fieldId: requireField(key).id,
          position,
          required: key === 'title',
        };
      }),
      ...subtaskFieldKeys.map((key, position) => {
        return {
          ticketTypeId: typeByKey['subtask']!.id,
          fieldId: requireField(key).id,
          position,
          required: key === 'title',
        };
      }),
    ]);

    const insertedSeverities = await tx
      .insert(fieldOptions)
      .values(
        SEVERITY_SEED.map(([value, label, color], position) => {
          return {
            fieldId: requireField('severity').id,
            value,
            label,
            position,
            config: { color },
          };
        }),
      )
      .returning();

    const insertedLinkTypes = await tx
      .insert(linkTypes)
      .values(
        LINK_TYPE_SEED.map(([key, label, inverseLabel, directional], position) => {
          return { projectId: project.id, key, label, inverseLabel, directional, position };
        }),
      )
      .returning();
    const linkTypeByKey = Object.fromEntries(insertedLinkTypes.map((row) => [row.key, row]));

    await tx.insert(views).values({
      projectId: project.id,
      name: 'Default',
      position: 0,
      config: {
        columns: [
          { source: 'number' },
          { source: 'type' },
          { source: 'field', fieldId: requireField('title').id },
          { source: 'field', fieldId: requireField('epic').id },
          { source: 'progress' },
          { source: 'field', fieldId: requireField('severity').id },
          { source: 'field', fieldId: requireField('status').id },
        ],
        sort: { source: 'number', dir: 'asc' },
        filters: {},
      },
    });

    return {
      project,
      claudeUserId,
      typeByKey,
      statusByKey,
      fieldByKey,
      severityOptions: insertedSeverities,
      linkTypeByKey,
    };
  });
}
