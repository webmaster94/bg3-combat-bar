import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
await mkdir('dist/bg3-combat-bar',{recursive:true});
for(const entry of ['module.json','scripts','styles','assets','README.md','LICENSE'])await cp(entry,`dist/bg3-combat-bar/${entry}`,{recursive:true});
const manifest=JSON.parse(await readFile('module.json','utf8'));
execFileSync('powershell',['-NoProfile','-Command',`Compress-Archive -LiteralPath 'dist/bg3-combat-bar' -DestinationPath 'dist/bg3-combat-bar-${manifest.version}.zip' -Force`],{stdio:'inherit'});
await writeFile('dist/module.json',JSON.stringify(manifest,null,2));
console.log(`Built dist/bg3-combat-bar-${manifest.version}.zip`);
