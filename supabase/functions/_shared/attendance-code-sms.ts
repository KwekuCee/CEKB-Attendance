export function buildAttendanceCodeSms(
  name: string,
  code: string,
  kind: 'member' | 'leader',
): string {
  const safeCode = String(code || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 50);
  const codeLabel = kind === 'leader' ? 'leader' : 'member';
  const template = `Hello , your ${codeLabel} code: ${safeCode}. Keep safe; share only with your church admin or usher to check in. God bless you.`;
  const nameBudget = Math.max(0, 160 - template.length);
  const safeName = String(name || '').replace(/[\r\n]+/g, ' ').trim().slice(0, nameBudget);
  return safeName ? template.replace('Hello ,', `Hello ${safeName},`) : template.replace('Hello ,', 'Hello,');
}
