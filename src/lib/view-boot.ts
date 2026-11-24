/** Where the theme and the card size are remembered. No React in this file: the server layout imports it. */
export const THEME_KEY = "casting.theme.v1";
export const SIZE_KEY = "casting.cardsize.v1";

/** Runs in <head> before the first paint, so a reload never flashes the other theme or size. */
export const BOOT = `try{var d=document.documentElement;if(localStorage.getItem("${THEME_KEY}")==="dark")d.dataset.mode="dark";var s=+localStorage.getItem("${SIZE_KEY}");if(s>=100&&s<=500)d.style.setProperty("--card-min",s+"px")}catch(e){}`;
