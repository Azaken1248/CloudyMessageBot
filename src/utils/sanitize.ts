/**
 * Every field reaching the notification channels comes from an unauthenticated
 * public form, so it is treated as hostile text and never as markup.
 *
 * Escaping happens at the point of interpolation rather than on input: the same
 * string is rendered into three different grammars (HTML body, HTML attribute,
 * Discord markdown), and each needs its own encoding. Sanitising once on the way
 * in would be wrong for at least two of them.
 */

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape for HTML text content and quoted attribute values alike. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Escape Discord's message-body markdown.
 *
 * Only characters Discord actually treats as formatting are escaped. Discord
 * consumes a backslash before a real special character, but renders it
 * literally before anything else — so escaping punctuation such as `-`, `:`,
 * `#` or `@` does not make text safer, it just fills ordinary sentences with
 * visible slashes ("half\\-body commission \\- is that possible?").
 *
 * `@` and `#` are deliberately absent: mentions do not resolve inside an embed
 * description, so there is nothing to neutralise.
 */
export function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_~|>])/g, '\\$1');
}

/** Trim to a hard limit, marking the cut so a truncated message is not mistaken for the whole one. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Conservative check used to decide whether an address is safe to turn into a
 * mailto link or a Reply-To header. Anything that fails is still shown as
 * escaped text, just not made actionable.
 */
export function isLikelyEmail(value: string): boolean {
  if (value.length > 254) return false;
  if (/[\s<>"'(),:;\\[\]]/.test(value)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(value);
}

/** Build a mailto URL with the address percent-encoded, then escaped for the attribute. */
export function mailtoHref(email: string): string {
  return escapeHtml(`mailto:${encodeURIComponent(email)}`);
}
