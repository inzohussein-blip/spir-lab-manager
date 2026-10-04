/**
 * Pages outside the admin panel's frame (no side menu, no top bar): the sign-in page, the welcome
 * page and the stations, the doctors' window and the code manager. Shared by the root layout (which
 * draws the frame or not) and LayoutGuard (which reloads the page when a link crosses between the
 * two, since the root layout is kept across in-app navigations).
 */
const BARE = ["/login", "/welcome", "/station", "/store", "/training", "/qc", "/roster", "/connect", "/doctor", "/license", "/signup", "/sync", "/about"];
export const isBarePath = (pathname: string): boolean =>
  BARE.some((b) => pathname === b || pathname.startsWith(b + "/"));
