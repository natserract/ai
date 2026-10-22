# Security review

`/act-sdlc:verify` runs this review on every change before an issue can leave Testing. It needs no external tool: Claude reads the code, follows the data, and proves findings with tests in the repository. If a developer happens to have a dedicated scanner or pentest tool installed, it can add evidence, but nothing depends on one.

The method follows the same principles as exploit-validated security testing:

1. **Model before you hunt.** Map the trust boundaries, the authorization model, and where attacker-controlled data flows, before looking for bugs.
2. **Prove, don't guess.** A finding counts when there's evidence, ideally a failing test that demonstrates the exploit. A suspicion without proof is reported as unconfirmed, never as a confirmed vulnerability.
3. **Report coverage honestly.** Say what was checked, what was proven, and what couldn't be assessed. "No findings" means none were found in what was reviewed, not that the code is secure.
4. **Fix the root cause.** Fix the shared helper, not the one call site. Then re-run the proof to show the exploit is closed.

## Scope

- **The diff, by default.** Review what this issue changed in this repository: committed and uncommitted changes against the base branch.
- **Plus what the diff touches.** Follow each changed function to its callers and to the data it reads and writes. A safe-looking change can open a hole elsewhere, for example by removing a check that a caller relied on.
- **The RFC tells you what matters.** The Call Graph's **boundary** nodes are where untrusted input enters. Its **Needs** column lists the dependencies, such as databases, vendors, and secrets. Its Risks section names what the team already worries about.

## Depth: standard or deep

| Depth | When | What it adds |
| :- | :- | :- |
| **Standard** | Every change | The checklist below, applied to the diff and its call paths |
| **Deep** | The change touches a sensitive area, or `--deep` is passed | Exploit tests for each plausible finding, a check of both sides of every authorization rule, and a walk through every boundary node in the Call Graph |

**Sensitive areas** trigger deep review automatically. Any of these signals counts:
- authentication, sessions, or tokens;
- authorization, roles, tenants, or ownership;
- payments, credits, quotas, or trials, such as ACT-95;
- personal or customer data, or files;
- a public or unauthenticated endpoint;
- an external vendor or webhook;
- LLM prompts built from user content;
- a database migration that changes access rules.

Detect them from the RFC (proposal, Call Graph needs and boundaries, Risks) and from the diff.

## Checklist

The checklist is mapped to the [OWASP Top 10:2025](https://owasp.org/Top10/) and, for APIs, the [OWASP API Security Top 10 (2023)](https://owasp.org/API-Security/). For each item that applies to the change, say whether it was checked and what was found.

| Area | Look for |
| :- | :- |
| **A01 Broken access control** (API1 BOLA, API5 function level, plus SSRF) | Lookups by id without an ownership or tenant check. Endpoints missing a role check. Trusting ids, roles, or flags sent by the client. Server-side requests to URLs the user controls |
| **A02 Misconfiguration** | Debug output, verbose errors, permissive CORS, insecure defaults, admin surfaces exposed |
| **A03 Supply chain** | New or upgraded dependencies: pinned, maintained, and free of known CVEs (run the project's audit command if one exists); install scripts |
| **A04 Cryptographic failures** | Secrets in code or logs, weak hashing, tokens without expiry, sensitive data sent or stored in plain text |
| **A05 Injection** | SQL, NoSQL, shell, template, or path injection; XSS in rendered output; prompt injection when user content reaches an LLM |
| **A06 Insecure design** (API6 business flows) | Abuse of the business logic: replays, race conditions such as double spends or double grants, skipped workflow steps, tampered price or quantity, missing rate limits |
| **A07 Authentication failures** | Bypasses, weak session handling, verification decided by the client (as in ACT-95's signup loophole), password reset and MFA flaws |
| **A08 Integrity failures** | Unsafe deserialization, unsigned webhooks or updates, trusting data from sources that aren't verified |
| **A09 Logging and alerting** | Security events not logged, or secrets and personal data written to logs. This often can't be assessed fully from code; say so |
| **A10 Exceptional conditions** | Fail-open error handling, swallowed exceptions that skip a check, timeouts that grant access, partial writes |
| **API3 Object property level** | Responses that expose internal fields, such as the risk scores ACT-95 must never return; mass assignment of fields the client shouldn't set |
| **API4 Resource consumption** | Unbounded queries, uploads, loops, or LLM calls a user can trigger |

## Reviewing without a checkout

`/act-sdlc:review` reviews a pull request from GitHub without checking it out, so it can't run exploit tests. In a review:
- **Confirmed:** the trace from attacker-controlled input to the sink is unambiguous in the code you read. Name every `file:line` along the way.
- **Unconfirmed:** the code looks unsafe, but the trace depends on something you couldn't see, such as configuration, middleware, or another service. Include the exploit test the author should write. `/act-sdlc:verify` will run it on their machine.

Severity follows the same table as below. In a review, though, severity drives the verdict and which findings become issues, rather than a pass or fail line in the RFC.

## Proving a finding

For each plausible finding:

1. Trace the path from the attacker-controlled input to the sink. Name the file and line of each step.
2. Write the smallest **exploit test** in the repository's test suite that shows the impact. For example: user B reads user A's record, the same grant applied twice yields double credits, or a crafted input reaches the query unescaped. Run it locally only, never against a shared or production environment.
3. **The test fails as an exploit (it succeeds in exploiting):** the finding is **confirmed**. Keep the test: once the fix lands it becomes a regression test, asserting the exploit is blocked.
4. **The exploit can't be shown, but the code is plainly unsafe:** the finding is **unconfirmed**. Report it with the reasoning.
5. **Ruled out:** drop it, and note it briefly under coverage.

## Severity and the gate

| Severity | Examples | Effect on `/verify` |
| :- | :- | :- |
| **Critical** | Auth bypass, cross-tenant data access, remote code execution, free credits for anyone | **Fails** the repo |
| **High** | IDOR on sensitive data, stored XSS, injection, a secret committed to the repo | **Fails** the repo |
| **Medium** | Missing rate limit, verbose errors that leak internals, weak validation that has limited impact | Passes, listed in the summary |
| **Low or info** | Hardening suggestions | Passes, mentioned in the report only |

An unconfirmed critical or high finding also fails the repo until someone either confirms it is safe or fixes it. Unproven doesn't mean safe.

## Report

For each repository, the report contains:
- the scope: base branch, files reviewed, and whether the depth was standard or deep, and why;
- the findings: severity, OWASP id, file and line, the exploit test, and the fix at the root cause;
- the coverage: each checklist area marked as checked, not applicable, or couldn't be assessed (with the reason);
- what was not reviewed, if anything.
