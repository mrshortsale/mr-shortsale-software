export const SIGNUP_EMAIL_DOMAIN = "mrshortsale.net";
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function isSignupDomainEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${SIGNUP_EMAIL_DOMAIN}`);
}
