export function buildAttendanceCodeSms(
  name: string,
  code: string,
  kind: 'member' | 'leader',
): string {
  const safeName = String(name || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80) || 'Beloved';
  const safeCode = String(code || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 64);
  const codeLabel = kind === 'leader' ? 'leader code' : 'member code';
  return `Hello ${safeName}, kindly find below your ${codeLabel}: ${safeCode}. Keep this code safe and only mention it to your Church admin or the Usher in charge of attendance to record your attendance in church. Thank you and God bless you.`;
}
