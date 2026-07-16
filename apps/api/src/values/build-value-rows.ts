import { HttpError } from '../errors';
import type { SchemeVocab } from '../vocab/load-scheme-vocab';

export interface ValueRow {
  fieldId: number;
  valueText?: string;
  valueNumber?: string;
  valueDate?: string;
  valueBool?: boolean;
  valueJson?: unknown;
  optionId?: number;
  valueUserId?: number;
}

export function buildValueRows(
  vocab: SchemeVocab,
  typeId: number,
  fieldKey: string,
  value: unknown,
): ValueRow[] {
  const field = vocab.fieldByTypeKey.get(`${typeId}:${fieldKey}`);
  if (!field || field.archivedAt) {
    throw new HttpError(400, `unknown field "${fieldKey}" for this item type`);
  }
  if (value === null || value === undefined) return [];

  switch (field.type) {
    case 'string': {
      if (typeof value !== 'string') throw new HttpError(400, `field "${fieldKey}" expects a string`);
      return [{ fieldId: field.id, valueText: value }];
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new HttpError(400, `field "${fieldKey}" expects a finite number`);
      return [{ fieldId: field.id, valueNumber: String(value) }];
    }
    case 'boolean': {
      if (typeof value !== 'boolean') throw new HttpError(400, `field "${fieldKey}" expects a boolean`);
      return [{ fieldId: field.id, valueBool: value }];
    }
    case 'date':
    case 'datetime': {
      const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
      const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
      const ok = typeof value === 'string'
        && (field.type === 'date' ? ISO_DATE.test(value) : ISO_DATETIME.test(value))
        && !Number.isNaN(Date.parse(value));
      if (!ok) throw new HttpError(400, `field "${fieldKey}" expects an ISO ${field.type} string`);
      return [{ fieldId: field.id, valueDate: value }];
    }
    case 'json': {
      return [{ fieldId: field.id, valueJson: value }];
    }
    case 'user': {
      if (typeof value !== 'number' || !Number.isInteger(value))
        throw new HttpError(400, `field "${fieldKey}" expects a user id`);
      return [{ fieldId: field.id, valueUserId: value }];
    }
    case 'option': {
      const multiple = (field.config as { multiple?: boolean }).multiple === true;
      const requested = multiple ? value : [value];
      if (!Array.isArray(requested) || requested.some((e) => typeof e !== 'string')) {
        throw new HttpError(
          400,
          multiple
            ? `field "${fieldKey}" expects an array of option value strings`
            : `field "${fieldKey}" expects an option value string`,
        );
      }
      const available = vocab.optionsForField(typeId, field.id);
      const built = (requested as string[]).map((optValue) => {
        const option = available.find((o) => o.value === optValue && !o.archivedAt);
        if (!option) throw new HttpError(400, `field "${fieldKey}" has no option "${optValue}"`);
        return { fieldId: field.id, optionId: option.id };
      });
      if (multiple) {
        const ids = built.map((r) => r.optionId);
        if (new Set(ids).size !== ids.length) throw new HttpError(400, `field "${fieldKey}" has duplicate options`);
      }
      return built;
    }
    default:
      throw new HttpError(400, `unsupported field type "${field.type}"`);
  }
}
