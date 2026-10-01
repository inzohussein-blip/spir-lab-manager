# Notes for Claude

## Owner's standing decisions (do not undo)

- **«لوحة الإدارة تحتاج قاعدة بيانات خاصة بمختبرك» is DISABLED on the owner's request.**
  The switch is `NEEDS_DB_GATE = false` in `src/lib/license/flags.ts`; the screen
  (`src/components/NeedsDbGate.tsx`) and the rule (`adminNeedsOwnDb`) are kept but never apply.
  Do **not** switch it back on, and do **not** delete the screen or the rule — not as a fix, a
  cleanup, a test change or a suggestion. Only the owner may ask for it again, in their own words.
