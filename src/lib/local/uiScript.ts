/** The look's storage keys and its pre-paint script (plain module: used by the root layout on the server). */
export const UI_KEY = "lab-ui";
/** The new look's accent (green when unset). */
export const UI_COLOR_KEY = "lab-ui-color";
/** Sets `data-ui="new"` (and its accent, `data-ui-color`) on <html> before the first paint when the new look was chosen (the classic is the default). */
export const uiScript = `try{if(localStorage.getItem('${UI_KEY}')==='new'){var d=document.documentElement;d.setAttribute('data-ui','new');var c=localStorage.getItem('${UI_COLOR_KEY}');if(c)d.setAttribute('data-ui-color',c)}}catch(e){}`;
