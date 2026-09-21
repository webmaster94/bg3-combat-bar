import {SECTION_COLUMNS as C,MAX_ROWS,PAGE_COUNT,isCustomSection} from './model.js';
const sectionKey=s=>['features','spells','items'].includes(s)||isCustomSection(s);
export const slotKey=ref=>`${ref.section}:${ref.index}`;
export function uniqueSlots(refs){
  const seen=new Set();return refs.filter(r=>sectionKey(r.section)&&Number.isInteger(r.index)&&r.index>=0&&r.index<C*MAX_ROWS&&!seen.has(slotKey(r))&&seen.add(slotKey(r))).map(r=>({section:r.section,index:r.index}));
}
export function groupsFor(data,page=data.page){
  const occupied=new Set();
  return (Array.isArray(data.groups)?data.groups:[]).filter(g=>g.page===page&&sectionKey(g.section)&&typeof g.id==='string'&&/^[\w-]+$/.test(g.id)).flatMap(g=>{
    const slots=uniqueSlots((Array.isArray(g.slots)?g.slots:[]).map(index=>({section:g.section,index}))).map(r=>r.index);
    if(!slots.length||slots.some(index=>occupied.has(`${g.section}:${index}`)))return [];
    slots.forEach(index=>occupied.add(`${g.section}:${index}`));
    return [{...g,name:String(g.name||'Group').slice(0,40),slots}];
  });
}
export function expandGroups(data,refs,page=data.page){
  const keys=new Set(refs.map(slotKey));
  return uniqueSlots([...refs,...groupsFor(data,page).filter(g=>g.slots.some(index=>keys.has(`${g.section}:${index}`))).flatMap(g=>g.slots.map(index=>({section:g.section,index})))]);
}
export function groupBounds(slots){
  const rows=slots.map(i=>Math.floor(i/C)),cols=slots.map(i=>i%C);
  return {row:Math.min(...rows),lastRow:Math.max(...rows),col:Math.min(...cols),lastCol:Math.max(...cols)};
}
export function addGroup(data,refs,name,id){
  refs=expandGroups(data,refs);const section=refs[0]?.section;
  if(!section||refs.some(r=>r.section!==section))throw Error('Choose slots within one section to make a group.');
  const b=groupBounds(refs.map(r=>r.index));
  if(refs.length!==(b.lastRow-b.row+1)*(b.lastCol-b.col+1))throw Error('Select a rectangular block of slots for this group.');
  ungroup(data,refs);data.groups??=[];data.groups.push({id,page:data.page,section,name:String(name).trim().slice(0,40)||'Group',slots:refs.map(r=>r.index)});
}
export function ungroup(data,refs,page=data.page){
  const keys=new Set(refs.map(slotKey));
  data.groups=(data.groups??[]).filter(g=>g.page!==page||!g.slots.some(index=>keys.has(`${g.section}:${index}`)));
}
export function removeSlots(data,refs,page=data.page){
  refs=expandGroups(data,refs,page);for(const r of refs)if(data.pages[page]?.[r.section])data.pages[page][r.section][r.index]=null;
  ungroup(data,refs,page);
}
export function planTransfer(data,refs,{page=data.page,anchor,destination}={}){
  if(!Number.isInteger(page)||page<0||page>=PAGE_COUNT)throw Error('Choose a valid page.');
  refs=expandGroups(data,refs);const fromPage=data.page;
  const rowShift=destination?Math.floor(destination.index/C)-Math.floor(anchor.index/C):0,colShift=destination?destination.index%C-anchor.index%C:0;
  const entries=refs.map(from=>{
    const row=Math.floor(from.index/C)+rowShift,col=from.index%C+colShift;
    const section=destination&&from.section===anchor.section?destination.section:from.section;
    if(row<0||row>=MAX_ROWS||col<0||col>=C||!data.pages[page]?.[section])throw Error('The selected slots do not fit at this location.');
    return {from,to:{section,index:row*C+col},itemId:data.pages[fromPage][from.section][from.index]};
  });
  if(new Set(entries.map(e=>slotKey(e.to))).size!==entries.length)throw Error('The selected slots would overlap each other at this location.');
  const source=new Set(refs.map(slotKey));
  const collisions=entries.filter(e=>!(page===fromPage&&source.has(slotKey(e.to)))&&data.pages[page][e.to.section][e.to.index]).map(e=>({...e.to,itemId:data.pages[page][e.to.section][e.to.index]}));
  const groups=groupsFor(data).filter(g=>g.slots.every(index=>source.has(`${g.section}:${index}`))).map(g=>{
    const mapped=g.slots.map(index=>entries.find(e=>e.from.section===g.section&&e.from.index===index).to);
    return {...g,page,section:mapped[0].section,slots:mapped.map(r=>r.index)};
  });
  return {fromPage,page,entries,collisions,groups};
}
export function applyTransfer(data,plan){
  // Read all sources before clearing any, so overlapping moves keep every icon.
  for(const e of plan.entries){if(data.pages[plan.fromPage][e.from.section][e.from.index]!==e.itemId)throw Error('These slots changed. Select them again.');}
  ungroup(data,plan.entries.map(e=>e.from),plan.fromPage);ungroup(data,plan.groups.flatMap(g=>g.slots.map(index=>({section:g.section,index}))),plan.page);
  for(const e of plan.entries)data.pages[plan.fromPage][e.from.section][e.from.index]=null;
  for(const e of plan.entries)data.pages[plan.page][e.to.section][e.to.index]=e.itemId;
  data.groups.push(...plan.groups);
}
export function rowGeometry(groups,rows){
  const bands=[...new Set(groups.map(g=>groupBounds(g.slots).row))].sort((a,b)=>a-b);
  const before=row=>bands.filter(r=>r<row).length*20;
  return {titleTop:row=>row*44+before(row),slotTop:row=>row*44+before(row)+(bands.includes(row)?20:0),height:rows*44-2+bands.filter(r=>r<rows).length*20};
}
