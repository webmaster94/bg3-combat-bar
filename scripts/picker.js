import {escapeHTML as esc} from './model.js';
import {itemActivities,itemState} from './item-state.js';

export const pickerCategory=item=>item.type==='spell'?'spells':item.type==='feat'?'features':'items';
export const pickerFilters={items:[['action','Action'],['bonus','Bonus Action'],['reaction','Reaction'],['equipped','Equipped'],['available','Can Use']],spells:[['action','Action'],['bonus','Bonus Action'],['reaction','Reaction'],['concentration','Concentration'],['prepared','Prepared'],['available','Can Cast']],features:[['action','Action'],['bonus','Bonus Action'],['reaction','Reaction'],['available','Can Use']]};
const inventoryGroups={weapon:'Weapons',equipment:'Equipment',consumable:'Consumables',tool:'Tools',container:'Containers',loot:'Loot'};
export function pickerGroup(item){
  if(item.type==='spell')return Number(item.system.level)?`Level ${item.system.level}`:'Cantrips';
  const section=item.flags?.['tidy5e-sheet']?.section;if(typeof section==='string'&&section.trim())return section.trim();
  if(item.type==='feat')return item.system.requirements||({class:'Class Features',race:'Species Features',background:'Background Features',feat:'Feats'}[item.system.type?.value])||'Other Features';
  return inventoryGroups[item.type]??'Other Items';
}
export function pickerEntries(items,{category='items',query='',filters=[],sort='name',actor}={}){
  const activation=filters.filter(f=>['action','bonus','reaction'].includes(f));
  const entries=items.filter(i=>{
    if(pickerCategory(i)!==category||!i.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))return false;
    const acts=itemActivities(i);
    if(activation.length&&!acts.some(a=>activation.includes(a.activation?.type))&&!activation.includes(i.system.activation?.type))return false;
    if(filters.includes('equipped')&&!i.system.equipped)return false;
    if(filters.includes('concentration')&&!i.system.properties?.has?.('concentration')&&!acts.some(a=>a.duration?.concentration))return false;
    const state=itemState(i,null,actor);
    if(filters.includes('available')&&state.unavailable)return false;
    if(filters.includes('prepared')&&state.reasons.includes('Not prepared'))return false;
    return true;
  }).sort((a,b)=>sort==='sheet'?(a.sort??0)-(b.sort??0):a.name.localeCompare(b.name));
  const groups=new Map();
  for(const item of entries){const key=pickerGroup(item);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
  return [...groups].sort(([a],[b])=>category==='spells'?(a==='Cantrips'?-1:b==='Cantrips'?1:a.localeCompare(b,undefined,{numeric:true})):a.localeCompare(b));
}

// All assignment and resource pickers use this renderer and the same filtering model.
export async function pickItem(ctx,title,predicate,{allowClear=true,emptyText='No matching items on this character.',category='all'}={}){
  const items=ctx.actor.items.filter(predicate),tabs=category==='all';
  let selected,current=tabs?'items':category,query='',sort='name';
  const filters={items:new Set(),spells:new Set(),features:new Set()},collapsed=new Set();
  await foundry.applications.api.DialogV2.wait({
    window:{title},position:{width:650},classes:['bg3-app','bg3-picker'],modal:true,rejectClose:false,
    content:`${tabs?'<nav class="bg3-picker-tabs" aria-label="Item types">'+['items','spells','features'].map(k=>`<button type="button" data-picker-tab="${k}" aria-pressed="${k===current}">${k[0].toUpperCase()+k.slice(1)}</button>`).join('')+'</nav>':''}<div class="bg3-picker-search"><input type="search" placeholder="Search this character…" aria-label="Search items"><select aria-label="Sort items"><option value="name">Name</option><option value="sheet">Sheet order</option></select><button type="button" data-collapse aria-label="Collapse all groups"><i class="fa-solid fa-angles-up" inert></i></button></div><div class="bg3-picker-filters" aria-label="Filters"></div><div class="bg3-item-list"></div>`,
    buttons:[...(allowClear?[{action:'clear',label:'Clear slot',callback:()=>{selected=null;}}]:[]),{action:'cancel',label:'Cancel'}],
    render:(_event,app)=>{
      const root=app.element,list=root.querySelector('.bg3-item-list');
      const draw=()=>{
        root.querySelectorAll('[data-picker-tab]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.pickerTab===current));
        const toolbar=root.querySelector('.bg3-picker-filters');
        toolbar.innerHTML=pickerFilters[current].map(([id,label])=>`<button type="button" data-filter="${id}" aria-pressed="${filters[current].has(id)}">${label}</button>`).join('');
        toolbar.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{const set=filters[current],id=b.dataset.filter;set.has(id)?set.delete(id):set.add(id);draw();});
        const groups=pickerEntries(items,{category:current,query,filters:[...filters[current]],sort,actor:ctx.actor});
        list.innerHTML=groups.map(([name,entries])=>`<details data-picker-group="${esc(name)}" ${collapsed.has(current+name)?'':'open'}><summary>${esc(name)} <small>${entries.length}</small></summary>${entries.map(i=>{
          const state=itemState(i,null,ctx.actor),activation=[...new Set(itemActivities(i).map(a=>a.activation?.type).filter(Boolean))].join(' / ');
          return `<button type="button" data-item-id="${esc(i.id)}" class="${state.unavailable?'is-unavailable':''}" title="${esc(state.reasons.join(' · '))}"><img src="${esc(i.img)}" alt=""><span class="bg3-picker-name">${esc(i.name)}${state.reasons.length?`<small class="bg3-unavailable-reason">${esc(state.reasons.join(' · '))}</small>`:''}</span><small>${esc(activation)}</small><span class="bg3-picker-count">${esc(state.badge)}${state.quantity?`<small>Qty ${esc(state.quantity)}</small>`:''}</span></button>`;
        }).join('')}</details>`).join('')||`<p>${esc(emptyText)}</p>`;
        list.querySelectorAll('[data-item-id]').forEach(b=>b.onclick=()=>{selected=b.dataset.itemId;app.close();});
        list.querySelectorAll('details').forEach(d=>d.ontoggle=()=>{const key=current+d.dataset.pickerGroup;d.open?collapsed.delete(key):collapsed.add(key);});
      };
      root.querySelector('input[type="search"]').oninput=e=>{query=e.target.value;draw();};
      root.querySelector('select').onchange=e=>{sort=e.target.value;draw();};
      root.querySelectorAll('[data-picker-tab]').forEach(b=>b.onclick=()=>{current=b.dataset.pickerTab;draw();});
      root.querySelector('[data-collapse]').onclick=e=>{const groups=[...list.querySelectorAll('details')],close=groups.some(d=>d.open);groups.forEach(d=>{d.open=!close;});e.currentTarget.setAttribute('aria-label',close?'Expand all groups':'Collapse all groups');};
      draw();
    }
  });
  return selected;
}
