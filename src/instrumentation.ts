/**
 * Server errors (a page or an action that failed) go to the owner's «سجل الأخطاء» while it is on
 * in /licenses → الإعدادات العامة. Only on the Node.js server; never affects the request.
 */
export async function onRequestError(
  err: unknown,
  request: { path: string; headers: Record<string, string | string[] | undefined> },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { licensingEnabled, recordError } = await import("@/lib/license/server");
    if (!licensingEnabled()) return;
    const { adminCookieLid } = await import("@/lib/license/adminCookie");
    const cookie = String(request.headers.cookie ?? "");
    const token = /(?:^|;\s*)lab_lic_admin=([^;]+)/.exec(cookie)?.[1];
    const e = err as { message?: string; digest?: string };
    await recordError({
      lid: await adminCookieLid(token ? decodeURIComponent(token) : undefined),
      kind: "server", path: request.path, message: e?.message ?? String(err), digest: e?.digest ?? "",
      agent: String(request.headers["user-agent"] ?? ""),
    });
  } catch { /* the log never breaks anything */ }
}
