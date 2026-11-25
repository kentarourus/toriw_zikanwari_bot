export const maxImageBase64Length = 380000;
export const maxTextRequestLength = 14000;

export function validChatImage(value) {
  return typeof value === 'string' && value.length >= 40 &&
    value.length <= maxImageBase64Length && value.length % 4 === 0 &&
    value.startsWith('/9j/') && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}
