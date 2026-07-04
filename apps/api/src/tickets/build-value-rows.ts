import { HttpError } from '../errors';
import type { ProjectVocab } from '../vocab/load-project-vocab';

type ValueRow = {
  fieldId: number;
  valueText?: string;
  valueNumber?: string;
  valueDate?: string;
  valueBool?: boolean;
  valueJson?: unknown;
  optionId?: number;
  statusId?: number;
};

// Turns one incoming { fieldKey: value } pair into ticket_values row fragments.
// null clears the field (zero rows). multi_select produces one row per option.
export function buildValueRows(vocab: ProjectVocab, fieldKey: string, value: unknown): ValueRow[] {
  const field = vocab.fieldByKey.get(fieldKey);
  if (!field || field.archivedAt) {
    throw new HttpError(400, `unknown field "${fieldKey}"`);
  }
  if (value === null || value === undefined) {
    return [];
  }

  if (field.type === 'text') {
    if (typeof value !== 'string') {
      throw new HttpError(400, `field "${fieldKey}" expects a string`);
    }
    return [{ fieldId: field.id, valueText: value }];
  }
  if (field.type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new HttpError(400, `field "${fieldKey}" expects a number`);
    }
    return [{ fieldId: field.id, valueNumber: String(value) }];
  }
  if (field.type === 'date') {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
      throw new HttpError(400, `field "${fieldKey}" expects an ISO date string`);
    }
    return [{ fieldId: field.id, valueDate: value }];
  }
  if (field.type === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new HttpError(400, `field "${fieldKey}" expects a boolean`);
    }
    return [{ fieldId: field.id, valueBool: value }];
  }
  if (field.type === 'json') {
    return [{ fieldId: field.id, valueJson: value }];
  }
  if (field.type === 'select' || field.type === 'multi_select') {
    const requested = field.type === 'select' ? [value] : value;
    if (!Array.isArray(requested) || requested.some((entry) => typeof entry !== 'string')) {
      throw new HttpError(
        400,
        field.type === 'select'
          ? `field "${fieldKey}" expects an option value string`
          : `field "${fieldKey}" expects an array of option value strings`,
      );
    }
    const available = vocab.optionsByFieldId.get(field.id) ?? [];
    return requested.map((optionValue) => {
      const option = available.find((row) => row.value === optionValue && !row.archivedAt);
      if (!option) {
        throw new HttpError(400, `field "${fieldKey}" has no option "${optionValue}"`);
      }
      return { fieldId: field.id, optionId: option.id };
    });
  }
  if (field.type === 'status') {
    if (typeof value !== 'string') {
      throw new HttpError(400, `field "${fieldKey}" expects a status key`);
    }
    const status = vocab.statusByKey.get(value);
    if (!status || status.archivedAt) {
      throw new HttpError(400, `unknown status "${value}"`);
    }
    return [{ fieldId: field.id, statusId: status.id }];
  }
  throw new HttpError(400, `unsupported field type "${field.type}"`);
}
