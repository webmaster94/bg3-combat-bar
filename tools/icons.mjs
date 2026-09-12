import {writeFile,mkdir} from 'node:fs/promises';
const assets=new URL('../assets/',import.meta.url);await mkdir(assets,{recursive:true});
const paths={
  dash:'<circle cx="39" cy="10" r="5"/><path d="m21 24 12-8 9 10 10 4M33 17l-6 18 12 9-7 14M27 35l-8 8-11 2M7 17h14M3 25h13M4 33h8"/>',
  disengage:'<circle cx="39" cy="12" r="5"/><path d="m39 20-9 13 10 8-3 17M31 32l-12 8-8 14M35 24l11 9 10-2M10 9v19m0 0-6-6m6 6 7-6M24 10l-5 10"/>',
  hide:'<path d="M5 33s10-17 27-17 27 17 27 17-10 17-27 17S5 33 5 33Z"/><circle cx="32" cy="33" r="10"/><path d="m8 56 48-48M9 10l4 4M52 50l4 4"/><path d="M26 33a6 6 0 0 1 6-6"/>',
  grapple:'<path d="m8 52 8-14 1-18q2-5 5-1v12l5-19q3-4 5 1l-2 19 6-21q4-3 5 2l-5 21 8-16q4-3 5 2l-6 19 8-7q6-1 4 4L43 50l-5 9M8 52l30 7M18 38l12 7M46 6l6 5 7 1M5 28l5 5"/>',
  shove:'<path d="M7 49h14l10-8 14-3q5-3 1-6l-14 1 4-18q-1-6-5-2l-7 16-8 6H7M8 35v14M43 13h15m0 0-6-6m6 6-6 6M39 53h17m0 0-5-5m5 5-5 5"/>',
  swords:'<path d="m8 5 11 5 30 34-5 5L10 19 8 5Zm-1 34 18 18M13 46 5 57m0 0 2 3M56 5 53 18 40 31M35 35 17 51M39 44l18-5M48 48l10 10"/>',
  bow:'<path d="M14 5q44 25 0 54L14 5Zm0 0 13 27-13 27M7 32h48m0 0-9-7m9 7-9 7M5 27l6 5-6 5"/>',
  rest:'<path d="M40 7a24 24 0 1 0 17 37A23 23 0 0 1 40 7Z"/><path d="m48 9 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6ZM12 52l5-5M8 44l6-2"/>',
  hourglass:'<path d="M19 7h26M19 57h26M22 7c0 14 3 18 10 25-7 7-10 11-10 25M42 7c0 14-3 18-10 25 7 7 10 11 10 25M24 14h16M25 50l7-10 7 10Z"/>',
  d20:'<path d="m32 4 25 17v25L32 60 7 46V21L32 4Zm0 0L18 25l14 23 14-23L32 4ZM7 21l11 4-11 21 25 2 25-2-11-21 11-4M32 48v12"/>'
};
for(const [name,path] of Object.entries(paths))await writeFile(new URL(`${name}.svg`,assets),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x2=".7" y2="1"><stop stop-color="#fff1c9"/><stop offset=".5" stop-color="#dcc38a"/><stop offset="1" stop-color="#8f713f"/></linearGradient></defs><g fill="none" stroke="#101b20" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${path}</g><g fill="none" stroke="url(#g)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${path}</g></svg>`);
