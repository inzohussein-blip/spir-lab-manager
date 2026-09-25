/** Lab Station appearance key and the pre-paint script (plain module: usable by the
 *  server layout and by client components). */
export const STATION_THEME_KEY = "station.theme.v1";

/** Runs before the station paints — avoids a flash of the wrong theme. */
export const STATION_THEME_SCRIPT = `try{var t=localStorage.getItem('${STATION_THEME_KEY}');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');else if(t==='light')document.documentElement.removeAttribute('data-theme')}catch(e){}`;
