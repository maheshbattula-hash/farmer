import { Types } from 'mongoose';

export function asIdString(value: unknown): string {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Types.ObjectId) {
    return value.toString();
  }
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return asIdString((value as { _id?: unknown })._id);
  }
  return String(value);
}

export function isValidObjectId(value: unknown): value is string {
  return typeof value === 'string' && Types.ObjectId.isValid(value);
}
