# ACCESS-CONTROL.md

## Telegram Access

- Bot mode: shared endpoint, isolated trust/approval.
- Owner (full approval rights): `chat_id=59890423`.
- Secondary user: `PENDING_CHAT_ID` (to be added after first message from that account).

## Approval Rules

1. **Only Owner can approve modifying actions** (`да/делай`).
2. Secondary user can:
   - ask questions,
   - request diagnostics,
   - request drafts/plans.
3. Secondary user cannot:
   - approve edits/config changes,
   - approve service restarts,
   - approve commits/pushes/deploy changes.

## Privacy / Memory Isolation

- Owner private memory (`MEMORY.md`) is owner-only context.
- For secondary user, use only non-owner-safe context and current chat history.
- Never quote Owner private notes to secondary user.

## Audit Trail

For every executed modifying action, log in daily memory:
- requester `chat_id`
- requested action
- preflight summary
- execution result
- rollback info (if used)
