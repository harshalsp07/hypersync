# Human PR writing: full examples

Before/after makeovers to pattern-match against. Every "before" is real text that agents produce; every "after" is the same information a human would have posted.

## PR description makeover

**Before:**

> ## 🚀 Introduction
>
> In today's fast-paced development landscape, efficient state management is crucial. This comprehensive PR introduces a powerful new caching layer that seamlessly enhances the data-fetching experience.
>
> It is worth noting that numerous improvements were made across the codebase. Furthermore, the implementation leverages a robust and elegant architecture. In conclusion, this PR significantly enhances the overall developer experience. Let me know if you have any questions!

**After:**

> Fixes #2210.
>
> ## What
> Adds an in-memory cache (60s TTL) in front of `get_user_settings()`. Repeat calls in a single request now hit the cache; writes invalidate it.
>
> ## Why
> `get_user_settings()` is called 4-6 times per request on the settings page (profiling in #2210), and each call is two DB queries. The cache cuts settings-page DB time from ~180ms to ~40ms.
>
> I considered memoizing per-request instead of a TTL cache, but background jobs call this too and wouldn't benefit. Went with TTL + explicit invalidation on write.
>
> ## Testing
> - New tests in `test_user_settings_cache.py` cover hit, miss, and invalidation.
> - `./tools/test-backend zerver.tests.test_settings` passes.
> - Local: loaded /settings before/after and watched the query log: 11 queries → 3.
>
> Known gap: TTL means up to 60s of staleness for cross-process writes. Acceptable per discussion in #2210, but flagging it.

What changed: every sentence now carries a fact (numbers, file names, decisions, limits). The fluff didn't get rewritten. It got deleted, and the space was filled with the Why and Testing sections the before version was missing.

## Review-reply makeovers

**1. Agreeing and fixing:**

Before:

> Great catch! You're absolutely right, that would indeed cause a race condition. I would be happy to fix that right away! 😊 Thank you so much for bringing this to my attention!

After:

> Good catch. The lock is now taken before the fetch, in a1b2c3.

**2. Disagreeing:**

Before:

> Thank you for this excellent suggestion! I have carefully considered your feedback. However, it is worth noting that there may be certain scenarios in which the current approach could be considered preferable. I would be more than happy to discuss this further!

After:

> I'd rather keep the polling here. Webhooks don't fire for the legacy auth provider (see provider docs, "Limitations"). If we move to the new provider in #3300 I'm happy to revisit.

**3. Admitting uncertainty:**

Before:

> That is a fantastic question! I believe that this code path should theoretically be safe in most scenarios, though further testing may potentially be warranted.

After:

> I haven't traced that path yet. Looking into it now. Will follow up here.

**4. Partial fix:**

Before:

> I have addressed the majority of your feedback. Please note that I was unable to address all of the comments at this point in time. I apologize for any inconvenience.

After:

> Pushed 2 commits: renamed `do_magic` → `sync_channel`, and dropped the unused import. Still open on the migration question: I've replied inline. I think we need to decide before I write it.

**5. Answering a reviewer's question:**

Before:

> That's a great question! Let me explain the reasoning behind this design decision in detail. As you mentioned, the function is called on every keystroke. There are several important factors to consider here. First and foremost…

After:

> It's called per keystroke, so I avoided the regex there. The string scan is ~10x faster for the 20-char titles we see. Benchmark: <link to comment with numbers>.

## "Changes pushed" comment

Before:

> I have made some changes to address the review feedback. The code has been updated accordingly. Please review the updated changes and let me know if there is anything else. Thank you!

After:

> Pushed 3 commits:
>
> 1. b1c2d3: guard against empty `workspace` (your comment on line 42)
> 2. e4f5a6: moved the validation into the model
> 3. b7c8d9: test for the empty-workspace case
>
> Forced-pushed, so the earlier SHAs are gone. The migration question from your second review pass is still open. Replied inline.
