import { expect, it } from 'vitest';
import { fieldIssues } from './field-issues';

const FIELDS = ['repositoryUrl', 'defaultBranch'] as const;

it('puts each issue at the field it names', () => {
  expect(
    fieldIssues('invalid command input: repositoryUrl: Not a git link.; defaultBranch: No spaces.', FIELDS),
  ).toEqual({ byField: { repositoryUrl: 'Not a git link.', defaultBranch: 'No spaces.' }, rest: null });
});

it('keeps what names no field, and any other error whole', () => {
  expect(fieldIssues('invalid command input: id: Invalid type', FIELDS)).toEqual({
    byField: {},
    rest: 'id: Invalid type',
  });
  expect(fieldIssues('project not found', FIELDS)).toEqual({ byField: {}, rest: 'project not found' });
});
