import { getTableConfig } from 'drizzle-orm/pg-core';
import { expect, it } from 'vitest';
import { workdirs } from './workdirs';

it('lives in core and links a project optionally', () => {
  const cfg = getTableConfig(workdirs);
  expect(cfg.schema).toBe('core');
  const projectId = cfg.columns.find((c) => c.name === 'project_id');
  expect(projectId).toBeDefined();
  expect(projectId?.notNull).toBe(false); // a workdir may stand alone
  expect(cfg.columns.find((c) => c.name === 'path')?.notNull).toBe(true);
});
