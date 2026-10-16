// Turns any error shape ({message}, Error, string) into displayable text.
export function errorText(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const m = (err as { message?: unknown })?.message;
  if (typeof m === 'string' && m) return m;
  return fallback;
}
