import type { Hue } from '@tilewise/ui';

export interface Project {
  id: number; key: string; name: string; schemeId: number; itemPrefix: string; createdAt: string;
  /** The git link everyone clones (https, ssh or git@host:path); null when none is set. */
  repositoryUrl: string | null;
  /** The branch work lands on; null is the remote's own default. Only set with a repository. */
  defaultBranch: string | null;
}

export type UserKind = 'human' | 'agent';
export interface User { id: number; name: string; email: string | null; kind: UserKind; archivedAt: string | null; }

export interface ItemType {
  id: number; schemeId: number; key: string; label: string; position: number;
  /** color is one of tilewise's hue names ("purple"), as stored since TK-5.21.1. */
  config: { color?: Hue } & Record<string, unknown>;
  archivedAt: string | null;
}

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'option' | 'user' | 'json';
export interface Field {
  id: number; schemeId: number; key: string; label: string; type: FieldType;
  config: { multiple?: boolean; workflow?: boolean; format?: string } & Record<string, unknown>;
  optionSetId: number | null;
  archivedAt: string | null;
}

// A field placed on a type.
export interface ItemTypeField {
  itemTypeId: number; fieldId: number; position: number; required: boolean;
  configOverride: { allowedOptionIds?: number[] } | null;
}

export type StatusKind = 'todo' | 'active' | 'blocked' | 'done' | 'dropped';
export interface Option {
  id: number; optionSetId: number; value: string; label: string; position: number;
  kind: StatusKind | null;                       // null for non-workflow options
  /** color is one of tilewise's hue names ("purple"), as stored since TK-5.21.1. */
  config: { color?: Hue; icon?: string } & Record<string, unknown>;
  archivedAt: string | null;
}

export interface Transition {
  id: number; fieldId: number; itemTypeId: number | null;
  fromOptionId: number | null; toOptionId: number;
  config: { guard?: { requiresComment?: boolean; requiresField?: string } } | null;
}

export interface LinkType { id: number; itemTypeId: number; key: string; label: string; inverseLabel: string; directional: boolean; position: number; archivedAt: string | null; }
export interface LinkTypeTargetType { linkTypeId: number; targetTypeId: number; }
export interface View { id: number; projectId: number; name: string; config: Record<string, unknown>; }
export interface ItemTypeChildType { parentTypeId: number; childTypeId: number; }

export interface Comment { id: number; itemId: number; authorId: number; parentId: number | null; body: string; createdAt: string; }
// why: why the link is there; on a plan's blocker, why the target waits on the source.
export interface ItemLink { id: number; linkTypeId: number; sourceItemId: number; targetItemId: number; why?: string | null; createdAt: string; }

export interface Item {
  // key: the item's name wherever it is written (TIX-90, TK/E14, TK-80.3),
  // unique across every project; number: its place in its project.
  id: number; number: number; key: string; typeId: number; parentId: number | null;
  createdBy: number; archivedAt: string | null; createdAt: string; updatedAt: string;
  values: Record<string, unknown>;               // fieldKey -> rendered (option value string, {id,name}, scalar, or array)
  comments: Comment[]; links: ItemLink[];
}

export interface Board {
  project: Project;
  /** A plan project: keys by the plan (TK/E14, TK-80, TK-80.3), items never move. */
  plan?: boolean;
  types: ItemType[];
  fields: Field[];
  placements: ItemTypeField[];
  options: Option[];
  transitions: Transition[];
  linkTypes: LinkType[];
  targetTypes: LinkTypeTargetType[];
  views: View[];
  users: User[];
  childTypes: ItemTypeChildType[];
  items: Item[];
}

export interface ActivityEntry {
  id: number; itemId: number; eventId: number; kind: string;
  actorId: number; at: string; correlationId: string; summary: Record<string, unknown>;
}

export interface CreateItemInput { projectKey: string; actorId: number; typeKey: string; parentId?: number | null; values: Record<string, unknown>; }
export interface PatchItemInput { itemId: number; actorId: number; expectedUpdatedAt: string; parentId?: number | null; archived?: boolean; values?: Record<string, unknown>; }
export interface CreatedItem { id: number; number: number; key: string; typeId: number; parentId: number | null; createdBy: number; archivedAt: string | null; createdAt: string; updatedAt: string; }
export interface PatchItemResult { id: number; updatedAt: string; }
export interface CreateCommentInput { itemId: number; actorId: number; body: string; parentId?: number | null; }
export interface CreateLinkInput { actorId: number; linkTypeKey: string; sourceItemId: number; targetItemId: number; why?: string; }
export interface DeleteLinkInput { linkId: number; actorId: number; }
export interface CreateUserInput { actorId: number; name: string; kind?: UserKind; }
export interface CreateProjectInput { actorId: number; key: string; name: string; itemPrefix: string; }

export interface UsersResponse { data: User[] }
