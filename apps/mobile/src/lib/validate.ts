// 저장해 둔 JSON 을 되살릴 때 쓰는 작은 검사 함수들.

export function parseJsonObject(json: string | null): Record<string, unknown> | null {
  if (!json) return null;

  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

export function isNullOr<T>(
  value: unknown,
  check: (value: unknown) => value is T,
): value is T | null {
  return value === null || check(value);
}

export const isString = (value: unknown): value is string => typeof value === 'string';
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
