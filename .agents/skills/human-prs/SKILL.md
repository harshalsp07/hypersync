---
name: human-prs
description: Write GitHub pull request descriptions, titles, review comments, and replies the way a thoughtful human engineer does: direct, evidence-led, free of AI and corporate filler. Use whenever opening or updating a pull request, writing or editing a PR description, replying to review feedback, or commenting on someone's PR, even if the user just says "open a PR", "address these comments", or "comment on the PR".
---

# Writing PRs like a human

Every word posted to GitHub should read like a busy, competent engineer wrote it between other tasks. Reviewers skim; their attention goes to the diff. Be short, concrete, and easy to act on, not performative.

These rules are about writing quality, not concealment. If a repository asks contributors to disclose AI assistance, follow that policy.

## Mindset

- You are writing for one reviewer with ten minutes, not for an audience or the archive.
- Every sentence must earn its place. Cut anything that restates the diff, the issue, or the previous message.
- State facts and evidence. Skip praise, apology, and enthusiasm you don't mean.
- Uncertainty is normal. "I haven't tested this on Windows" is a better sentence than a vague claim of full coverage.

## Before opening a PR

1. Read the repo's CONTRIBUTING.md, its PR template, and 2-3 recently merged PRs. Match their title style, description structure, changelog requirements, and commit conventions. If the repo ships its own PR-writing skill or checklist, that wins over this file.
2. Search open PRs and issues for related work. Mention it if it exists: "Similar to #1234, but this also handles the streaming case."
3. One PR, one logical change. Split drive-by fixes into separate PRs.
4. Open a draft PR if you want direction before it's review-ready, and say so: "Draft: the migration approach is open to feedback."

## PR title

- Imperative and specific: "compose: Fix cursor jumping after emoji insert", not "Various fixes and improvements".
- Follow the repo's prefix convention if it has one (`area:` prefixes, conventional commits, etc.).
- Don't add AI-attribution markers to titles or descriptions: no `[ai]` tags, robot emoji, or "Generated with …" footers, unless the repository's own policy requires them. Repo disclosure policy wins: if a repo mandates a tag (Zulip's `[ai]` prefix, for example), use it exactly as specified and exactly once, in the form the policy gives; never add one on your own initiative.
- Keep it accurate as scope changes during review.

## PR description: answer three questions

Reviewers arrive with three questions. Answer them in order, then stop.

1. **What changed?** One short paragraph or a few bullets, describing behavior, not a walkthrough of the diff. If a bullet could be read off the diff, cut it.
2. **Why?** The problem being solved, with the issue linked (`Fixes #123`). Include the reasoning behind non-obvious decisions and alternatives you rejected. This is where you save the reviewer a round-trip question.
3. **How to test?** Concrete steps a human can follow: commands, repro steps, what they should see afterward. If you ran the tests, name them; paste the interesting output, not the transcript.

Add only what earns its place beyond that:

- UI changes: before/after screenshots or a short GIF.
- Performance claims: numbers and methodology, or don't make the claim.
- Breaking changes and migration notes: at the top, never buried.
- Known gaps: list what you did *not* handle.

Example:

```markdown
Fixes #4821.

## What
Reject push-notification payloads over 4KB at enqueue time and log the
dropped payload at WARN.

## Why
Oversized payloads were crashing the bouncer worker (#4821). Dropping
them at enqueue keeps the worker alive; we still log so oversized senders
can be found.

## Testing
- `python -m pytest tests/test_notifications.py -k payload`: 6 new cases, all pass.
- Repro on staging: POST a 5KB payload → 400 response, worker stays up
  (previously the worker died within ~30s).
- Not handled: payloads from legacy v1 senders (#4903).
```

The opposite of this reads like: "This PR is a comprehensive refactor that leverages a robust, seamless notification pipeline. It is worth noting that numerous improvements were made across the codebase. In conclusion, this enhances the overall developer experience." No facts, no issue link, no test steps, every sentence filler.
## Comments and review replies

Write like a senior engineer leaving a quick note: brief, direct, polite, technical.

- Lead with the answer, not the acknowledgment. Don't restate the question or quote the thread back.
- One reply per point, inline on the thread. Resolve the thread when it's addressed. Don't post a top-level summary of every thread unless the reviewer asked for one.
- Addressing feedback: "Good catch, fixed in a1b2c3." For several changes: "Pushed 2 commits addressing these: (1) renamed the helper, (2) added the missing guard." Reviewers shouldn't have to diff-hunt. If the repo rebases-and-force-pushes during review, do that but still post what changed.
- Disagreeing: give the reason, offer an alternative, then defer. "I'd rather keep the retry here. Without it the worker loses events on restart. Happy to add a comment explaining that instead. If you still want it gone, I'll take it out."
- Not knowing: "Haven't traced why that path is hit yet. Investigating." Don't manufacture an answer.
- Length: often one sentence. A reply that is one sentence long should not be a bullet list.

## Vocabulary blacklist

These phrases mark text as machine-written and add no information. Where a replacement is listed, use it; otherwise delete the phrase and state the point directly.

| Instead of | Write |
|---|---|
| "It is worth noting that…", "Please note that…" | (delete: just state the thing) |
| "In conclusion", "First and foremost", "Last but not least" | (delete) |
| "Furthermore" / "Moreover" / "Additionally" as sentence openers | start with the actual point |
| "In order to" | "to" |
| "Due to the fact that" | "because" |
| "utilize", "leverage" | "use" |
| "delve into" | "look at" |
| "seamless(ly)" | (delete: say what actually works) |
| "robust", "comprehensive", "powerful", "elegant" | name the concrete property instead |
| "streamline" | "simplify" / "speed up" |
| "crucial", "pivotal", "game-changing" | "important", or delete |
| "myriad", "a plethora of" | "many" / "several" |
| "enhance the overall experience" | say what specifically got better |
| "—" (em dash) | comma, period, or colon |

Banned comment patterns:

- "Great catch! I would be happy to fix that right away." → "Good catch, fixed in <sha>."
- "You're absolutely right!", "Excellent point!", "Fantastic question!" → (delete; "Good point." is fine when you genuinely agree)
- "I apologize for the confusion / oversight." → "Ah, that was my mistake, fixed."
- "Thank you so much for bringing this to my attention." → "Thanks for the review." (once, at most)
- "Let me know if you have any questions!", "Hope this helps!", "Feel free to reach out." → (delete)
- "As an AI language model…" → (never)

## Other AI tells

Vocabulary isn't the only giveaway. Also avoid:

- Perfectly parallel bullet lists everywhere. Humans mix prose and bullets; use bullets only for genuinely list-like content (steps, options).
- Headers inside a five-line message. Use headers in descriptions only when the repo template has them or the PR is long enough to need them.
- Uniform sentence rhythm and triple structures ("not only X, but Y; moreover Z"). Vary length. Fragments are fine.
- Emoji and bold emphasis sprinkled in for energy. Skip unless the repo uses them.
- Hedging every claim ("it seems that perhaps this might…"). State it, or mark it plainly as uncertain.
- Em dashes ("—"). They read as machine-written and many style guides ban them. Use a comma, period, or colon instead. Never use "—" in PR titles, descriptions, comments, or commit messages.

## Honesty rules

- Never claim a test, build, or manual check you didn't run. "I haven't run this against a real instance yet" is a fine sentence.
- Back claims with evidence: link the failing CI run, paste the benchmark, name the commit.
- Don't edit an old comment to change what you said after people replied. Post a follow-up instead: "Correction: the limit is 4KB, not 8KB."

## Reviewing someone else's PR

Same tone rules, opposite direction:

- Read the description and the linked issue before the diff.
- Ask before asserting: "Is this safe when the table is empty?" not "This is wrong."
- Mark non-blocking points with `nit:`. Say explicitly when something blocks you: "Blocking: this drops events on restart."
- Use GitHub suggestion blocks for mechanical fixes instead of describing them in prose.
- Say "nice" once when it's true. Don't open with praise as lubricant.

## Commit messages

Same voice: imperative mood, factual, no filler. Follow the repo's convention for prefixes and structure; that convention wins over anything here.

## Before you post (30-second check)

- Could any sentence be deleted with no information lost? Delete it.
- Any blacklisted phrase left? Remove it.
- Any em dash left? Replace it with a comma, period, or colon.
- Does the description answer What / Why / How to test, with the issue linked?
- Did I claim anything I didn't verify?
- Does it read as one message from a person, or three from a marketing department?

## More examples

Read `references/examples.md` for full before/after makeovers of PR descriptions and review replies when you want a pattern to match.
