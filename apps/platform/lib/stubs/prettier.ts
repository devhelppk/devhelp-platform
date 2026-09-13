/**
 * Stands in for `prettier/standalone` and `prettier/plugins/html` in the server
 * bundle (aliased in `next.config.ts`).
 *
 * `@react-email/render`'s Node build imports Prettier at module top level for
 * its `pretty` option, and bundlers cannot tree-shake a top-level import. That
 * put **4.76 MB of Prettier** into the production Worker (S22 spike), about a
 * sixth of its uncompressed size, for an option we never pass.
 *
 * If someone does pass `{ pretty: true }` one day, this throws loudly rather
 * than silently sending unformatted mail.
 */
export function format(): never {
  throw new Error(
    "Prettier is stubbed out of the server bundle; @repo/email must not call render with { pretty: true }.",
  );
}

export default { format };
