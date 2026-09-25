/** Per-station appearance (plain module: used by the server layouts and by client code).
 *  Each station keeps its own choice under its own key; nothing is shared. */
export const THEME_KEYS = {
  station: "station.theme.v1",
  store: "purchasing.theme.v1",
  training: "training.theme.v1",
  qc: "qc.theme.v1",
  roster: "roster.theme.v1",
} as const;
export type ThemeStation = keyof typeof THEME_KEYS;

/** Inline script that applies the station's choice before it paints (no flash). */
export const themeScript = (key: string) =>
  `try{var t=localStorage.getItem('${key}');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');else if(t==='light')document.documentElement.removeAttribute('data-theme')}catch(e){}`;
