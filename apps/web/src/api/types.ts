export interface Project { id: number; key: string; name: string; schemeId: number; itemPrefix: string; createdAt: string; }

export type UserKind = 'human' | 'agent';
export interface User { id: number; name: string; email: string | null; kind: UserKind; archivedAt: string | null; }

export interface ItemType {
  id: number; schemeId: number; key: string; label: string;
  config: { color?: string } & Record<string, unknown>;
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
  config: { color?: string; icon?: string } & Record<string, unknown>;
  archivedAt: string | null;
}

export interface Transition {
  id: number; fieldId: number; itemTypeId: number | null;
  fromOptionId: number | null; toOptionId: number;
  config: { guard?: { requiresComment?: boolean; requiresField?: string } } | null;
}

export interface LinkType { id: number; itemTypeId: number; key: string; label: string; inverseLabel: string; directional: boolean; position: number; archivedAt: string | null; }
export interface View { id: number; projectId: number; name: string; config: Record<string, unknown>; }

export interface Comment { id: number; itemId: number; authorId: number; parentId: number | null; body: string; createdAt: string; }
export interface ItemLink { id: number; linkTypeId: number; sourceItemId: number; targetItemId: number; createdAt: string; }

export interface Item {
  id: number; number: number; typeId: number; parentId: number | null;
  createdBy: number; archivedAt: string | null; createdAt: string; updatedAt: string;
  values: Record<string, unknown>;               // fieldKey -> rendered (option value string, {id,name}, scalar, or array)
  comments: Comment[]; links: ItemLink[];
}

export interface Board {
  project: Project;
  types: ItemType[];
  fields: Field[];
  placements: ItemTypeField[];
  options: Option[];
  transitions: Transition[];
  linkTypes: LinkType[];
  views: View[];
  users: User[];
  items: Item[];
}

export interface ActivityEntry {
  id: number; itemId: number; eventId: number; kind: string;
  actorId: number; at: string; correlationId: string; summary: Record<string, unknown>;
}

// The envelope every mutation body carries.
export interface CommandEnvelope { commandId: string; actorId: number; }

export interface CreateItemInput { projectKey: string; actorId: number; typeKey: string; parentId?: number | null; values: Record<string, unknown>; }
export interface PatchItemInput { itemId: number; actorId: number; expectedUpdatedAt: string; parentId?: number | null; archived?: boolean; values?: Record<string, unknown>; }
export interface CreatedItem { id: number; number: number; typeId: number; parentId: number | null; createdBy: number; archivedAt: string | null; createdAt: string; updatedAt: string; }
export interface PatchItemResult { id: number; updatedAt: string; }
export interface CreateCommentInput { itemId: number; actorId: number; body: string; parentId?: number | null; }
export interface CreateLinkInput { actorId: number; linkTypeKey: string; sourceItemId: number; targetItemId: number; }
export interface DeleteLinkInput { linkId: number; actorId: number; }
export interface CreateUserInput { name: string; kind?: UserKind; }
export interface CreateProjectInput { key: string; name: string; itemPrefix: string; }

export interface ListMeta { total?: number }
export interface UsersResponse { data: User[] }
export interface ProjectsResponse { data: Project[] }
