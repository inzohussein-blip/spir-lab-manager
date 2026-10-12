/** The look's storage key and its pre-paint script (plain module: used by the root layout on the server). */
export const UI_KEY = "lab-ui";
/** Sets `data-ui="new"` on <html> before the first paint when the new green look was chosen (the classic is the default). */
export const uiScript = `try{if(localStorage.getItem('${UI_KEY}')==='new')document.documentElement.setAttribute('data-ui','new')}catch(e){}`;
