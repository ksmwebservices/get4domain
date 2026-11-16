import { mailFlags } from './core/mail-core';
import { mailError } from './mail.errors';

/**
 * Is the system mail lane switched on (EMAIL_LIVE_SEND, default OFF)? A route that has to send a code by email asks this BEFORE it creates or reveals anything, and answers the registered code MAIL_DISABLED
 * (503) when it is off. The answer depends on the switch only, never on who asked or whether an account exists, so it cannot be used to find out anything about a person. Provided globally by V3MailModule;
 * a build or a test without it simply has no check.
 */
export const MAIL_ENABLED = Symbol('MAIL_ENABLED');
export type MailEnabled = () => boolean;
export const envMailEnabled: MailEnabled = () => mailFlags(process.env).send;

export function assertMailEnabled(check: MailEnabled | undefined): void {
  if (check && !check()) throw mailError(503, 'MAIL_DISABLED', 'Email is switched off right now, so a code cannot be sent by email.');
}
