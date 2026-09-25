/** Activation state of the local stations on this device (plain module: the pre-paint
 *  script is used by server layouts, the helpers by the client). */
export const ACT_KEY = "local.activation.v1"; // "legacy" | "pending" | "activated"

/** Runs before a station/welcome page renders, once per device: a browser that already
 *  holds station data from earlier versions is treated as activated (never asked);
 *  a new one becomes "pending". Must run before any station writes its first data. */
export const ACTIVATION_SCRIPT = `try{if(!localStorage.getItem('${ACT_KEY}')){var p=['station.','training.','qc.','roster.','purchasing.','local-offline-ready'],old=false;for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i)||'';for(var j=0;j<p.length;j++){if(k.indexOf(p[j])===0){old=true;}}}localStorage.setItem('${ACT_KEY}',old?'legacy':'pending')}}catch(e){}`;
