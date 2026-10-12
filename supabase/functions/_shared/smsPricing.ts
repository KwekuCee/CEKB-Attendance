const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENDED = '\f^{}\\[~]|€';

export interface SmsEstimate {
  encoding: 'GSM-7' | 'Unicode';
  characters: number;
  pagesPerMessage: number;
  recipientCount: number;
  totalPages: number;
  unitRate: number;
  estimatedCost: number;
}

export function estimateSmsCost(message: string, recipientCount: number, unitRate: number): SmsEstimate {
  let encoding: SmsEstimate['encoding'] = 'GSM-7';
  let characters = 0;
  for (const char of message) {
    if (GSM_BASIC.includes(char)) characters += 1;
    else if (GSM_EXTENDED.includes(char)) characters += 2;
    else {
      encoding = 'Unicode';
      break;
    }
  }
  if (encoding === 'Unicode') characters = message.length;
  const singleLimit = encoding === 'GSM-7' ? 160 : 70;
  const multipartLimit = encoding === 'GSM-7' ? 153 : 67;
  const pagesPerMessage = characters <= singleLimit ? 1 : Math.ceil(characters / multipartLimit);
  const recipients = Math.max(0, Math.floor(recipientCount));
  const rate = Number.isFinite(unitRate) && unitRate >= 0 ? unitRate : 0;
  const totalPages = pagesPerMessage * recipients;
  return {
    encoding,
    characters,
    pagesPerMessage,
    recipientCount: recipients,
    totalPages,
    unitRate: rate,
    estimatedCost: totalPages * rate,
  };
}
