/**
 * Switches kept in the code (not in the owner's settings).
 *
 * NEEDS_DB_GATE — the «لوحة الإدارة تحتاج قاعدة بيانات خاصة بمختبرك» screen (components/NeedsDbGate)
 * and the rule behind it (prefs.adminNeedsOwnDb): a paid code's admin panel stayed closed until a
 * database of its own was linked.
 *
 * ⚠️ NOTE TO CLAUDE / ANY FUTURE CHANGE: DISABLED ON THE OWNER'S EXPLICIT REQUEST. Do NOT switch it
 * back on, and do NOT delete the screen or the rule — leave both as they are. Only the owner may ask
 * for it again, in their own words. While off, every lab's panel opens in its own section of the
 * site's database until a database of its own is linked (labs never see each other's data).
 */
export const NEEDS_DB_GATE = false;
