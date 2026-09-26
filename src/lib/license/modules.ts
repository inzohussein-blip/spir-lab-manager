/** What a lab code can switch on (shared by the server, the stations and the code manager). */
export const LICENSE_MODULES = [
  { id: "station", label: "محطة المختبر", path: "/station" },
  { id: "purchasing", label: "منظومة المشتريات", path: "/store" },
  { id: "training", label: "محطة التدريب والمعلومات", path: "/training" },
  { id: "qc", label: "محطة الجودة والأجهزة", path: "/qc" },
  { id: "roster", label: "محطة الكادر والدوام", path: "/roster" },
  { id: "admin", label: "لوحة الإدارة الكاملة", path: "/" },
] as const;

export type LicenseModule = (typeof LICENSE_MODULES)[number]["id"];
export const MODULE_IDS = LICENSE_MODULES.map((m) => m.id) as LicenseModule[];
/** A new code gets the local stations; the full admin panel is switched on per code. */
export const DEFAULT_MODULES: LicenseModule[] = ["station", "purchasing", "training", "qc", "roster"];
export const moduleLabel = (id: string) => LICENSE_MODULES.find((m) => m.id === id)?.label ?? id;
export const cleanModules = (v: unknown): LicenseModule[] =>
  Array.isArray(v) ? MODULE_IDS.filter((id) => v.includes(id)) : [...DEFAULT_MODULES];

/** Signed license carried by a device (JWT payload, ES256). */
export interface LicensePayload {
  lid: string;      // license id
  lab: string;      // lab name
  dev: string;      // device id it is bound to
  mods: LicenseModule[];
  until: number;    // expiry, ms since epoch
  iat?: number;
}

/** The admin-panel cookie (HS256, AUTH_SECRET) read by the middleware. */
export const ADMIN_LICENSE_COOKIE = "lab_lic_admin";
