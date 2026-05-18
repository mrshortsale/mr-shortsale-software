export const SIGNUP_EMAIL_DOMAIN = 'mrshortsale.net';

export function isSignupDomainEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${SIGNUP_EMAIL_DOMAIN}`);
}
