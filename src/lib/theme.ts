/**
 * Runs in the layout's <head> before the page paints, so a theme picked with the header's
 * moon button (components/ThemeToggle, saved as localStorage "theme") never flashes the other one first.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;
