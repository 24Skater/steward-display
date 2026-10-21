# Security Policy

## Supported versions

Steward Display has not cut a `1.0.0` release. Until it does, the supported version is
**whatever is on `main`**.

## Reporting a vulnerability

Please **do not open a public issue.** Report privately through
**[GitHub private security advisories](https://github.com/24Skater/steward-display/security/advisories/new)**.

That is the only channel. There is no `security@` mailbox: an address nobody reads is worse
than none, because a reporter who hears nothing may reasonably disclose publicly instead.

Include a description, steps to reproduce, the impact you expect, and a suggested fix if you
have one.

## What to expect

- **Acknowledgment** within a week.
- **Status updates** when there is something to report.
- **Critical issues** are prioritised over everything else.
- **Coordinated disclosure:** we credit you in the release notes unless you prefer otherwise,
  tell you before disclosure, and ask for 90 days before you publish.

These commitments are deliberately modest. Steward is maintained by very few people, and a
security policy that is quietly broken is worse than one that is modest and kept.

## Scope notes

- Anything shown on a Display View is broadcast to a room. Treat screen content as public:
  aggregate giving totals only, never per-donor amounts, named prayer requests, or children's
  names or photos.
- The admin app and Display Views are not meant to be indexed; every response carries
  `X-Robots-Tag: noindex`.
