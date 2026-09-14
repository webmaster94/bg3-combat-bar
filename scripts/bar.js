import {itemState} from './item-state.js';
import {ID,SECTIONS,SECTION_COLUMNS,MAX_ROWS,PAGE_COUNT,resizeSections,isCustomSection,GENERICS,escapeHTML as esc,matchesItem,usesBadge} from "./model.js";
import {layout,editLayout,economy,actionCost,isTurn,equipLoadout,serial,setEconomy,changeSpellSlots} from "./state.js";
import {classResources} from "./resources.js";
import {sectionName,visibleSectionOrder,editSection,hideSection} from './sections.js';
import {ActivityPopover,usableActivities,activityUses} from './activities.js';
import {resourceFrame} from "./resource-frame.js";
import {EffectsDock} from "./effects.js";
import {choose,pickItem,showPanel} from "./dialogs.js";
import {generic,requestGM,clearHidden} from "./actions.js";

const icon = (name,cls="") => `<img class="bg3-generic-icon ${cls}" src="modules/${ID}/assets/${name}.svg" alt="">`;
const label = value => game.i18n.localize(value?.label ?? value ?? "");
export class CombatBar {
  constructor(){this.ctx=null;this.macroMode=false;this.tooltipGeneration=0;this.busy=false;this.renderQueued=false;this.activities=new ActivityPopover(this);}
  schedule(){if(this.resizing||this.renderQueued)return;this.renderQueued=true;requestAnimationFrame(()=>{this.renderQueued=false;if(!this.resizing)this.render();});}
  setContext(ctx){if(this.ctx?.token?.uuid!==ctx?.token?.uuid){this.cancelResize?.();this.hideTooltip();}this.ctx=ctx;this.schedule();}
  visible(){return this.ctx?.actor?.isOwner && ["character","npc"].includes(this.ctx.actor.type) && (game.combat?.started||game.settings.get(ID,"outsideCombat"));}
  applyScale(){if(this.root?.isConnected)this.root.style.setProperty('--bg3-scale',Math.min(game.settings.get(ID,'scale'),(innerWidth-130)/this.root.offsetWidth));}
  paintResources(){
    const resources=this.root?.querySelector('.bg3-resources');if(!resources)return;
    resources.querySelector('.bg3-resource-outline')?.remove();
    const upper=resources.querySelector('.bg3-class-resources'),tiered=!!resources.querySelector('.bg3-spell-resources .spell')&&!!upper;
    resources.insertAdjacentHTML('afterbegin',resourceFrame(resources.offsetWidth,resources.offsetHeight,tiered?upper.offsetWidth:0,tiered?upper.offsetHeight-2:0));
  }
  render(){
    this.activities.close();this.root?.remove();this.swap?.remove();this.hideTooltip();
    this.effectsDock=null;document.body.classList.remove('bg3-docked-effects');
    const visible=this.visible();document.body.classList.toggle("bg3-replaces-hotbar",!!visible&&!this.macroMode);
    if(!visible)return;
    if(this.macroMode){this.swap=document.createElement("button");this.swap.className="bg3-return";this.swap.title="Return to BG3 Combat Bar";this.swap.innerHTML=`${icon("swords")} Combat bar`;this.swap.onclick=()=>{this.macroMode=false;this.render();};document.body.append(this.swap);return;}
    const ctx=this.ctx,data=layout(ctx),actor=ctx.actor,hp=actor.system.attributes.hp,frac=Math.max(0,Math.min(1,(hp.value??0)/(hp.max||1)));
    const root=this.root=document.createElement("section");root.id="bg3-combat-bar";root.setAttribute("aria-label",`BG3 Combat Bar: ${actor.name}`);
    root.classList.toggle("is-locked",data.locked);root.style.setProperty("--bg3-scale",game.settings.get(ID,"scale"));
    root.style.setProperty("--rows",data.rows);root.style.setProperty("--offset-x",`${data.offset.x}px`);root.style.setProperty("--offset-y",`${data.offset.y}px`);
    root.innerHTML=`<div class="bg3-main"><div class="bg3-portrait-wrap"><div class="bg3-identity"><button class="bg3-drag-bar" data-command="move" aria-label="Drag combat bar" title="Drag the bar when unlocked">◆</button><span class="bg3-actor-name">${esc(actor.name)}</span></div><button class="bg3-portrait" data-command="sheet" title="Open character sheet" style="--hp:${frac*100}%;--damage:${(1-frac)*100}%"><img src="${esc(actor.img)}" alt="${esc(actor.name)}"><span class="bg3-health-fill"></span><span class="bg3-health">${hp.value??0}<small> / ${hp.max??0}</small></span>${hp.temp>0?`<span class="bg3-temp">+${hp.temp}</span>`:""}</button><button class="bg3-checks" data-command="checks" aria-label="Skills and saving throws" title="Skills and saving throws">${icon("d20")}</button></div>
      ${this.weapons(ctx,data)}<div class="bg3-action-frame"><div class="bg3-resource-crown"><div class="bg3-resources" data-resource-drop>${this.resources(ctx,data)}</div></div><div class="bg3-sections">${visibleSectionOrder(data).map(section=>this.section(ctx,data,section)).join("")}</div>
      <nav class="bg3-controls" aria-label="Bar controls"><div class="bg3-control-column"><small>Page</small><button data-command="previous" aria-label="Previous page" title="Previous page">▴</button><span>${data.page+1}/${PAGE_COUNT}</span><button data-command="next" aria-label="Next page" title="Next page">▾</button></div><div class="bg3-control-column"><small>Rows</small><button data-command="moreRows" aria-label="Add row" title="Add row" ${data.rows>=MAX_ROWS||data.locked?'disabled':''}>+</button><span>${data.rows}</span><button data-command="fewerRows" aria-label="Remove row" title="Remove row" ${data.rows<=2||data.locked?'disabled':''}>−</button></div><div class="bg3-control-bottom"><button data-command="lock" aria-label="${data.locked?"Unlock":"Lock"} bar" title="${data.locked?"Unlock":"Lock"} bar"><i class="fa-solid ${data.locked?"fa-lock":"fa-unlock"}"></i></button><button data-command="macros" title="Show Foundry macro bar" aria-label="Show Foundry macro bar">▦</button></div></nav></div>
      <button class="bg3-end-turn ${isTurn(ctx)?"is-turn":""}" data-command="endTurn" ${isTurn(ctx)?"":"disabled"} aria-label="End turn">${icon("hourglass")}<small>End turn</small></button><button class="bg3-rest" data-command="rest" title="Short or long rest" aria-label="Rest">${icon("rest")}</button></div>`;
    document.body.append(root);this.paintResources();this.applyScale();this.bind(ctx,data);
    this.effectsDock=new EffectsDock(this,ctx);this.effectsDock.render().catch(error=>console.error(`${ID} | effects`,error));
  }
  resources(ctx,data){
    const e=economy(ctx),spells=ctx.actor.system.spells??{},pools=classResources(ctx.actor),hasSpellSlots=Object.values(spells).some(s=>Number(s.max)>0);
    let html=`<div class="bg3-economy-resources">${[['action','Action','●'],['bonus','Bonus action','▲'],['reaction','Reaction','↶']].map(([key,name,symbol])=>`<button class="bg3-resource ${key} ${e[key]?'':'spent'}" data-economy="${key}" aria-label="${name}: ${e[key]} remaining" title="${name} · click to spend, right-click to restore"><i>${symbol}</i><span>${e[key]}</span></button>`).join('')}`;
    if(e.attacks>0)html+=`<span class="bg3-resource attacks" title="Attacks remaining in your Attack action">⚔ ${e.attacks}</span>`;
    html+='</div><div class="bg3-casting-resources">';
    if(pools.length)html+=`<div class="bg3-class-resources">${pools.map((r,i)=>`<button class="bg3-resource bg3-class-pool ${r.kind} ${hasSpellSlots?'with-spellcasting':''}" data-class-resource="${i}" aria-label="${esc(r.name)}: ${r.value} of ${r.max}" title="${esc(r.name)} · ${r.value}/${r.max} · click to ${r.itemId?'use feature':'spend a point'}, right-click to ${r.itemId?'open feature':'restore a point'}"><small>${esc(r.name)}</small><span class="bg3-pips" aria-hidden="true">${Array.from({length:Math.min(40,r.max)},(_,n)=>`<i class="${n<r.value?'':'spent'}">◆</i>`).join('')}</span><span class="bg3-pool-count">${r.value}/${r.max}</span></button>`).join('')}</div>`;
    html+='<div class="bg3-spell-resources">';
    for(const [key,spell] of Object.entries(spells)){
      if(!(Number(spell.max)>0))continue;
      const name=key==='pact'?'Pact slots':`Level ${key.replace('spell','')} spell slots`;
      html+=`<button class="bg3-resource spell" data-spell-slots="${esc(key)}" aria-label="${name}: ${spell.value} of ${spell.max}" title="${name} · ${spell.value}/${spell.max} · click to spend one, right-click to restore one"><small>${key==='pact'?'P':key.replace('spell','')}</small><span class="bg3-pips" aria-hidden="true">${Array.from({length:Math.min(12,spell.max)},(_,i)=>`<i class="${i<spell.value?'':'spent'}">◆</i>`).join('')}</span></button>`;
    }
    html+='</div></div><div class="bg3-custom-resources">';
    for(const [i,r] of data.resources.entries()){
      if(r.itemId&&pools.some(pool=>pool.itemId===r.itemId))continue;
      const item=r.itemId?ctx.actor.items.get(r.itemId):null;
      const text=item?usesBadge(item):`${r.value??r.max}/${r.max}`;
      html+=`<button class="bg3-resource custom" data-custom="${i}" title="${esc(item?.name??r.name)} · click to use, right-click to configure">${item?`<img src="${esc(item.img)}" alt="">`:'<i>✦</i>'}<small>${esc(item?.name??r.name)}</small><span>${esc(text||'—')}</span></button>`;
    }
    return html+`</div><button class="bg3-add-resource" data-command="resource" aria-label="Add Resource" title="Track a feature, spell, item, or custom counter">+</button>`;
  }
  weapons(ctx,data){
    const type=data.weaponTab,index=data.weaponSet[type];
    return `<section class="bg3-section bg3-weapons" data-section="weapons"><header><span>Weapons</span></header><div class="bg3-weapon-tabs"><button data-weapon-type="melee" class="${type==='melee'?'active':''}" title="Melee loadouts">${icon('swords')}</button><button data-weapon-type="ranged" class="${type==='ranged'?'active':''}" title="Ranged loadouts">${icon('bow')}</button></div><div class="bg3-weapon-slots">${data.weapons[type][index].map((id,hand)=>this.slot(ctx,id,{section:type,index:hand,loadout:index,weapon:true,hand,locked:data.locked})).join('')}</div><div class="bg3-loadouts">${[0,1].map(i=>`<button data-loadout="${i}" class="${index===i?'active':''}" title="Equip ${type} loadout ${i+1}">${i+1===1?'I':'II'}</button>`).join('')}<small>${data.activeLoadout?.type===type&&data.activeLoadout?.index===index?'Equipped':'Stored'}</small></div></section>`;
  }
  section(ctx,data,section){
    const width=data.widths[section],slots=data.pages[data.page][section];
    return `<section class="bg3-section bg3-${section}" data-section="${section}" style="--section-width:${width}px"><header class="${section==='features'?'bg3-feature-headings':''}" draggable="${!data.locked}" data-section-drag="${section}">${section==='features'?'<span>Actions</span><span>Features</span>':`<span>${esc(sectionName(section))}</span>${isCustomSection(section)?`<span class="bg3-section-tools"><button type="button" data-edit-section="${section}" aria-label="Edit ${esc(sectionName(section))}" title="Edit section settings"><i class="fa-solid fa-pencil" inert></i></button><button type="button" data-hide-section="${section}" aria-label="Hide ${esc(sectionName(section))} for me" title="Hide for me"><i class="fa-solid fa-eye-slash" inert></i></button></span>`:''}`}</header><div class="bg3-section-content">${section==='features'?`<div class="bg3-generics">${Object.entries(GENERICS).map(([id,a])=>`<button class="bg3-slot bg3-generic" data-generic="${id}" aria-label="${a.name}">${icon(id)}<span class="bg3-cost ${actionCost(ctx.actor,id)}"></span></button>`).join('')}</div>`:''}<div class="bg3-viewport"><div class="bg3-grid">${slots.map((id,index)=>this.slot(ctx,id,{section,index,locked:data.locked,offscreen:Math.floor(index/SECTION_COLUMNS)>=data.rows||(index%SECTION_COLUMNS)*44>=width})).join('')}</div></div></div><div class="bg3-section-resize" data-resize="${section}" role="separator" tabindex="${data.locked?-1:0}" aria-label="Resize ${esc(sectionName(section))} section" aria-orientation="vertical" aria-valuemin="42" aria-valuemax="526" aria-valuenow="${width}" title="Drag to resize ${esc(sectionName(section))}"></div></section>`;
  }
  slot(ctx,id,{section,index,loadout,weapon=false,hand=0,offscreen=false,locked=false}){
    const item=ctx.actor.items.get(id),name=item?.name??(weapon?`${hand?'Off hand':'Main hand'} ${section}`:{features:'Slot a Feature',spells:'Slot a Spell',items:'Slot an Item'}[section]??`Slot into ${sectionName(section)}`);
    const state=itemState(item,null,ctx.actor),badge=state.badge;
    return `<div class="bg3-slot-wrap"><button tabindex="${offscreen?-1:0}" class="bg3-slot ${item?'filled':'empty'} ${state.unavailable?'is-unavailable':''}" data-slot="${section}:${index}" data-item="${esc(item?.id??'')}" ${weapon?`data-loadout-index="${loadout}"`:''} draggable="${!!item&&!locked}" ${usableActivities(item).length>1?'aria-haspopup="dialog" aria-expanded="false"':''} aria-label="${esc(name)}">${item?`<img src="${esc(item.img)}" alt="">`:`<span class="bg3-empty-icon">${weapon?(hand?'Ⅱ':'Ⅰ'):'+'}</span>`}${badge?`<span class="bg3-uses">${esc(badge)}</span>`:''}${usableActivities(item).length>1?'<span class="bg3-activity-indicator" aria-hidden="true"><i class="fa-solid fa-angles-up"></i></span>':''}${state.quantity?`<span class="bg3-quantity">${esc(state.quantity)}</span>`:''}${item?.system?.level?`<span class="bg3-level">${item.system.level}</span>`:''}</button></div>`;
  }
  bind(ctx,data){
    const root=this.root;
    const run=fn=>async e=>{try{await fn(e);}catch(error){console.error(`${ID} |`,error);ui.notifications.error(error.message);}};
    root.querySelectorAll('[data-edit-section]').forEach(b=>b.onclick=run(e=>{e.stopPropagation();return editSection(b.dataset.editSection);}));
    root.querySelectorAll('[data-hide-section]').forEach(b=>b.onclick=run(e=>{e.stopPropagation();return hideSection(b.dataset.hideSection);}));
    root.querySelectorAll('[data-command]').forEach(b=>b.onclick=run(e=>this.command(b.dataset.command,ctx,data,e)));
    root.querySelectorAll('[data-generic]').forEach(b=>{b.onclick=run(()=>serial(`${ctx.token.uuid}:barUse`,()=>generic(ctx,b.dataset.generic)));this.hover(b,()=>this.genericTooltip(ctx,b.dataset.generic));});
    root.querySelectorAll('[data-slot]').forEach(b=>{
      b.onclick=run(e=>b.dataset.item?this.useItem(ctx,ctx.actor.items.get(b.dataset.item),e):this.assign(ctx,b));
      b.oncontextmenu=run(e=>{e.preventDefault();return this.assign(ctx,b);});
      if(b.dataset.item)this.hover(b,()=>this.itemTooltip(ctx,ctx.actor.items.get(b.dataset.item)));
      b.ondragstart=e=>{if(data.locked){e.preventDefault();return;}e.dataTransfer.setData('text/plain',JSON.stringify({type:'Item',uuid:ctx.actor.items.get(b.dataset.item)?.uuid,bg3:{owner:ctx.document.uuid,page:data.page,slot:b.dataset.slot,loadout:b.dataset.loadoutIndex}}));this.activities.close();};
      b.ondragover=e=>{if(!data.locked){e.preventDefault();b.classList.add('drop-target');}};
      b.ondragleave=()=>b.classList.remove('drop-target');
      b.ondrop=run(async e=>{e.preventDefault();e.stopPropagation();b.classList.remove('drop-target');if(data.locked)return;let drop;try{drop=JSON.parse(e.dataTransfer.getData('text/plain'));}catch{return;}if(drop.type!=='Item')return;const item=await fromUuid(drop.uuid);if(item?.actor?.uuid!==ctx.actor.uuid)throw new Error("Drag an item from this character's sheet.");await this.assignItem(ctx,b,item.id,drop.bg3);});
    });
    root.querySelectorAll('[data-weapon-type]').forEach(b=>b.onclick=run(()=>editLayout(ctx,d=>{d.weaponTab=b.dataset.weaponType;})));
    root.querySelectorAll('[data-loadout]').forEach(b=>b.onclick=run(()=>editLayout(ctx,d=>equipLoadout(ctx,d,d.weaponTab,Number(b.dataset.loadout)))));
    root.querySelectorAll('[data-resize]').forEach(handle=>this.bindResize(handle,ctx,data,run));
    root.querySelectorAll('[data-section-drag]').forEach(h=>h.ondragstart=e=>{if(data.locked)return e.preventDefault();e.dataTransfer.setData('text/plain',JSON.stringify({bg3Section:h.dataset.sectionDrag}));});
    root.querySelectorAll('[data-section]').forEach(s=>{s.ondragover=e=>{if(!data.locked)e.preventDefault();};s.ondrop=run(async e=>{if(data.locked)return;e.preventDefault();let value;try{value=JSON.parse(e.dataTransfer.getData('text/plain'));}catch{return;}if(!data.order.includes(value.bg3Section))return;await editLayout(ctx,d=>{d.order=d.order.filter(k=>k!==value.bg3Section);d.order.splice(d.order.indexOf(s.dataset.section),0,value.bg3Section);});});});
    root.querySelectorAll('[data-economy]').forEach(b=>{b.onclick=run(()=>setEconomy(ctx,b.dataset.economy));b.oncontextmenu=run(e=>{e.preventDefault();return setEconomy(ctx,b.dataset.economy,true);});});
    root.querySelectorAll('[data-spell-slots]').forEach(b=>{b.onclick=run(()=>changeSpellSlots(ctx,b.dataset.spellSlots));b.oncontextmenu=run(e=>{e.preventDefault();return changeSpellSlots(ctx,b.dataset.spellSlots,true);});});
    root.querySelectorAll('[data-class-resource]').forEach(b=>{
      const pool=classResources(ctx.actor)[Number(b.dataset.classResource)],item=ctx.actor.items.get(pool.itemId);
      if(item)this.hover(b,()=>this.itemTooltip(ctx,item,'class'));
      b.onclick=run(e=>item?this.useItem(ctx,item,e):this.changeClassResource(ctx,pool,-1));
      b.oncontextmenu=run(e=>{e.preventDefault();return item?item.sheet.render(true):this.changeClassResource(ctx,pool,1);});
    });
    root.querySelectorAll('[data-custom]').forEach(b=>{const item=ctx.actor.items.get(data.resources[Number(b.dataset.custom)].itemId);if(item)this.hover(b,()=>this.itemTooltip(ctx,item,true));b.onclick=run(e=>this.useResource(ctx,Number(b.dataset.custom),e));b.oncontextmenu=run(e=>{e.preventDefault();return this.configureResource(ctx,Number(b.dataset.custom));});});
    const resources=root.querySelector('[data-resource-drop]');resources.ondragover=e=>{if(!data.locked)e.preventDefault();};resources.ondrop=run(async e=>{e.preventDefault();if(data.locked)return;let drop;try{drop=JSON.parse(e.dataTransfer.getData('text/plain'));}catch{return;}const item=drop.uuid?await fromUuid(drop.uuid):null;if(item?.actor?.uuid!==ctx.actor.uuid||!usesBadge(item))throw new Error("Drop a feature, spell, or item with its own limited uses from this character.");await editLayout(ctx,d=>{if(!d.resources.some(r=>r.itemId===item.id))d.resources.push({itemId:item.id});});});
    const grip=root.querySelector('[data-command="move"]');grip.onpointerdown=e=>{
      if(data.locked||e.button!==0)return;e.preventDefault();this.activities.close();grip.setPointerCapture(e.pointerId);const start={x:e.clientX,y:e.clientY};let offset={...data.offset};
      grip.onpointermove=ev=>{offset={x:Math.max(-innerWidth/2+100,Math.min(innerWidth/2-100,data.offset.x+ev.clientX-start.x)),y:Math.max(-innerHeight+220,Math.min(0,data.offset.y+ev.clientY-start.y))};root.style.setProperty('--offset-x',`${offset.x}px`);root.style.setProperty('--offset-y',`${offset.y}px`);};
      grip.onpointerup=run(async()=>{grip.onpointermove=null;grip.onpointerup=null;await editLayout(ctx,d=>{d.offset=offset;});});
    };
  }
  async assign(ctx,button){if(layout(ctx).locked)return ui.notifications.info("Unlock the bar to change slots.");const [section,index]=(button.dataset.slot??button.dataset.assign).split(':');this.hideTooltip();const title={features:'Slot a Feature',spells:'Slot a Spell',items:'Slot an Item',melee:'Slot a Melee Weapon',ranged:'Slot a Ranged Weapon'}[section]??`Slot into ${sectionName(section)}`;const id=await pickItem(ctx,title,item=>matchesItem(item,section,Number(index)),{category:isCustomSection(section)?'all':['melee','ranged'].includes(section)?'items':section});if(id===undefined)return;await this.assignItem(ctx,button,id);}
  bindResize(handle,ctx,data,run){
    const key=handle.dataset.resize;
    handle.onkeydown=run(async e=>{
      if(data.locked||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      e.preventDefault();e.stopPropagation();
      await editLayout(ctx,d=>{d.widths=resizeSections(d.widths,visibleSectionOrder(d),key,e.key==='Home'?-1000:e.key==='End'?1000:e.key==='ArrowRight'?8:-8);});
    });
    handle.onpointerdown=e=>{
      if(data.locked||e.button!==0)return;
      e.preventDefault();e.stopPropagation();this.activities.close();this.resizing=true;
      const root=this.root,bounds=root.getBoundingClientRect();
      const scale=bounds.width/root.offsetWidth,start=e.clientX;
      let widths={...data.widths};
      root.style.left=`${bounds.left}px`;root.style.transformOrigin='bottom left';root.style.transform=`translateY(${data.offset.y}px) scale(${scale})`;
      root.classList.add('is-resizing');handle.setPointerCapture(e.pointerId);
      const finish=async save=>{
        const width=root.getBoundingClientRect().width;
        handle.onpointermove=null;handle.onpointerup=null;handle.onpointercancel=null;
        if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);
        document.removeEventListener('keydown',cancel);this.cancelResize=null;this.resizing=false;
        root.style.removeProperty('left');root.style.removeProperty('transform');root.style.removeProperty('transform-origin');root.classList.remove('is-resizing');
        if(save)await editLayout(ctx,d=>{d.widths=widths;d.offset.x=data.offset.x+(width-bounds.width)/2;});
        this.schedule();
      };
      const cancel=ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();run(()=>finish(false))(ev);}};
      this.cancelResize=()=>run(()=>finish(false))({});document.addEventListener('keydown',cancel);
      handle.onpointermove=ev=>{
        widths=resizeSections(data.widths,visibleSectionOrder(data),key,(ev.clientX-start)/scale);
        for(const [section,value] of Object.entries(widths)){root.querySelector(`[data-section="${section}"]`)?.style.setProperty('--section-width',`${value}px`);root.querySelector(`[data-resize="${section}"]`)?.setAttribute('aria-valuenow',value);}
        this.paintResources();
        this.effectsDock?.layout();
      };
      handle.onpointerup=run(()=>finish(true));handle.onpointercancel=run(()=>finish(false));
    };
  }
  async assignItem(ctx,button,id,source){
    const [section,rawIndex]=(button.dataset.slot??button.dataset.assign).split(':'),index=Number(rawIndex),weapon=['melee','ranged'].includes(section),item=id?ctx.actor.items.get(id):null;
    if(id&&!matchesItem(item,section,index))throw new Error(`That item does not fit a ${section} slot.`);
    await editLayout(ctx,async d=>{
      if(d.locked)return;
      const destination=weapon?d.weapons[section][Number(button.dataset.loadoutIndex)]:d.pages[d.page][section];const previous=destination[index];
      destination[index]=id;
      if(source?.owner===ctx.document.uuid){const [ss,si]=source.slot.split(':'),src=['melee','ranged'].includes(ss)?d.weapons[ss][Number(source.loadout)]:d.pages[source.page]?.[ss];if(src&&!(src===destination&&Number(si)===index)&&(!previous||matchesItem(ctx.actor.items.get(previous),ss,Number(si))))src[Number(si)]=previous;}
      if(weapon)await equipLoadout(ctx,d,section,Number(button.dataset.loadoutIndex));
    });
  }
  async useItem(ctx,item,event){
    if(!item)return;
    if(usableActivities(item).length>1){
      const anchor=event?.currentTarget??this.root?.querySelector(`[data-item="${item.id}"]`);
      if(anchor?.isConnected)return this.activities.open(ctx,item,anchor);
    }
    return serial(`${ctx.token.uuid}:barUse`,async()=>{this.usingActor=ctx.actor.uuid;try{return await item.use({event});}finally{this.usingActor=null;}});}
  async useActivity(ctx,activity,event){
    if(!activity.canUse)return ui.notifications.warn('That activity is no longer available.');
    return serial(`${ctx.token.uuid}:barUse`,async()=>{this.usingActor=ctx.actor.uuid;try{return await activity.use({event});}finally{this.usingActor=null;}});
  }
  async command(command,ctx,data,event){
    if(command==='sheet')return ctx.actor.sheet.render(true);
    if(command==='macros'){this.macroMode=true;return this.render();}
    if(command==='checks')return this.checks(ctx);
    if(command==='lock')return editLayout(ctx,d=>{d.locked=!d.locked;});
    if(command==='previous'||command==='next')return editLayout(ctx,d=>{d.page=(d.page+(command==='next'?1:-1)+d.pages.length)%d.pages.length;});
    if(command==='moreRows'||command==='fewerRows'){if(data.locked)return;return editLayout(ctx,d=>{d.rows=Math.max(2,Math.min(MAX_ROWS,d.rows+(command==='moreRows'?1:-1)));});}
    if(command==='endTurn'){if(isTurn(ctx))return game.user.isGM?game.combat.nextTurn():requestGM({action:'endTurn',source:ctx.token.uuid});return;}
    if(command==='rest'){const pick=await choose('Rest',`<p>${esc(ctx.actor.name)}</p>`,[{value:'short',label:'Short rest'},{value:'long',label:'Long rest'}]);if(!pick)return;return pick.button==='short'?ctx.actor.shortRest():ctx.actor.longRest();}
    if(command==='resource')return this.addResource(ctx);
  }
  async checks(ctx){
    const actor=ctx.actor,abilities=Object.entries(CONFIG.DND5E.abilities),skills=Object.entries(CONFIG.DND5E.skills),signed=n=>Number(n)>=0?`+${n}`:n;
    const content=`<div class="bg3-check-columns"><section><h3>Saving throws</h3>${abilities.map(([key,a])=>`<button type="button" data-save="${key}"><span>${esc(label(a))}</span><b>${signed(actor.system.abilities[key]?.save?.value??actor.system.abilities[key]?.mod??0)}</b></button>`).join('')}</section><section><h3>Skills</h3>${skills.map(([key,s])=>`<button type="button" data-skill="${key}"><span>${actor.system.skills[key]?.proficient?'◆ ':''}${esc(label(s))}</span><b>${signed(actor.system.skills[key]?.total??0)}</b></button>`).join('')}</section></div><div>${actor.effects.some(e=>e.getFlag(ID,'kind')==='hide')?'<button type="button" data-reveal>End hiding</button>':''}${actor.effects.filter(e=>e.getFlag(ID,'kind')==='grapple').map(e=>`<button type="button" data-escape="${e.id}">Escape grapple · DC ${e.getFlag(ID,'dc')}</button>`).join('')}</div>`;
    return showPanel(actor.name,content,app=>{
      const root=app.element,close=()=>app.close();
      root.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{close();actor.rollSavingThrow({ability:b.dataset.save});});root.querySelectorAll('[data-skill]').forEach(b=>b.onclick=()=>{close();actor.rollSkill({skill:b.dataset.skill});});
      root.querySelector('[data-reveal]')?.addEventListener('click',()=>{close();clearHidden(actor);});
      root.querySelectorAll('[data-escape]').forEach(b=>b.onclick=()=>{close();requestGM({action:'escape',source:ctx.token.uuid,effect:b.dataset.escape}).catch(e=>ui.notifications.error(e.message));});
    });
  }
  async addResource(ctx,index){
    if(layout(ctx).locked)return ui.notifications.info('Unlock the bar to change resources.');
    this.hideTooltip();
    const choice=await choose('Add Resource','<p>Track uses from a feature, spell, or item, or create your own counter.</p><p>You can also drag an entry with limited uses onto the resource strip. Spells that only spend spell slots are already tracked by the slot diamonds.</p>',[{value:'feature',label:'Feature'},{value:'spell',label:'Spell'},{value:'item',label:'Item'},{value:'custom',label:'Custom Counter'}],{width:520});
    if(!choice)return;
    if(choice.button==='custom')return this.configureResource(ctx,index,true);
    const kind=choice.button;
    const id=await pickItem(ctx,{feature:'Track a Feature',spell:'Track a Spell',item:'Track an Item'}[kind],i=>!!usesBadge(i)&&(kind==='feature'?i.type==='feat':kind==='spell'?i.type==='spell':!['feat','spell'].includes(i.type)),{category:{feature:'features',spell:'spells',item:'items'}[kind],allowClear:false,emptyText:'No matching entries with limited uses. Set up uses on the character sheet first. Spells that only use spell slots are tracked automatically.'});
    if(!id)return;
    await editLayout(ctx,d=>{if(d.resources.some((r,i)=>r.itemId===id&&i!==index))return;if(index===undefined)d.resources.push({itemId:id});else d.resources[index]={itemId:id};});
  }
  async configureResource(ctx,index,custom=false){
    const data=layout(ctx);if(data.locked)return;const existing=data.resources[index];
    if(existing?.itemId&&!custom){
      const item=ctx.actor.items.get(existing.itemId);
      const choice=await choose('Tracked Resource',`<p><strong>${esc(item?.name??'Missing item')}</strong> · ${esc(usesBadge(item)||'No limited uses')}</p><p>Uses and recovery come from the character sheet. Click the resource to use it.</p>`,[{value:'replace',label:'Change Resource'},{value:'remove',label:'Remove'}]);
      if(choice?.button==='replace')return this.addResource(ctx,index);
      if(choice?.button==='remove')return editLayout(ctx,d=>{d.resources.splice(index,1);});
      return;
    }
    const r=existing&&!existing.itemId?existing:{name:'Resource',max:3,value:3,reset:'long'};
    const result=await choose('Custom Counter',`<label>Name<input name="name" value="${esc(r.name)}" required maxlength="40"></label><div class="bg3-form-row"><label>Current<input name="value" type="number" min="0" max="999" value="${r.value}" required></label><label>Maximum<input name="max" type="number" min="1" max="999" value="${r.max}" required></label></div><label>Recover on<select name="reset"><option value="long" ${r.reset==='long'?'selected':''}>Long rest</option><option value="short" ${r.reset==='short'?'selected':''}>Short or long rest</option><option value="turn" ${r.reset==='turn'?'selected':''}>Start of turn</option><option value="manual" ${r.reset==='manual'?'selected':''}>Manual</option></select></label>`,[{value:'save',label:'Save'},...(index!==undefined?[{value:'remove',label:'Remove'}]:[])]);
    if(!result)return;await editLayout(ctx,d=>{if(result.button==='remove')d.resources.splice(index,1);else{const f=result.data;const next={name:f.get('name'),value:Math.min(Number(f.get('value')),Number(f.get('max'))),max:Number(f.get('max')),reset:f.get('reset')};if(index===undefined)d.resources.push(next);else d.resources[index]=next;}});
  }
  async useResource(ctx,index,event){const r=layout(ctx).resources[index];if(r.itemId)return this.useItem(ctx,ctx.actor.items.get(r.itemId),event);return editLayout(ctx,d=>{d.resources[index].value=Math.max(0,(d.resources[index].value??d.resources[index].max)-1);});}
  async changeClassResource(ctx,pool,delta){return serial(`${ctx.document.uuid}:classResource`,async()=>{const resource=ctx.actor.system.resources[pool.resourceKey];await ctx.actor.update({[`system.resources.${pool.resourceKey}.value`]:Math.max(0,Math.min(resource.max,resource.value+delta))});});}
  hover(button,content,onShow){
    const show=()=>{
      clearTimeout(this.hoverTimer);clearTimeout(this.leaveTimer);
      const generation=++this.tooltipGeneration;
      this.hoverTimer=setTimeout(async()=>{
        const html=await content();if(generation!==this.tooltipGeneration||!button.isConnected)return;
        this.tooltip?.remove();const tip=this.tooltip=document.createElement('aside');
        tip.className='bg3-tooltip';tip.setAttribute('role','tooltip');tip.innerHTML=html;document.body.append(tip);
        onShow?.(tip);
        const r=button.getBoundingClientRect(),t=tip.getBoundingClientRect();
        tip.style.left=`${Math.max(8,Math.min(innerWidth-t.width-8,r.left))}px`;tip.style.top=`${Math.max(8,r.top-t.height-14)}px`;
        tip.onmouseenter=()=>clearTimeout(this.leaveTimer);tip.onmouseleave=leave;
      },250);
    };
    const leave=()=>{clearTimeout(this.hoverTimer);this.tooltipGeneration++;this.leaveTimer=setTimeout(()=>this.hideTooltip(),180);};
    button.onmouseenter=show;button.onfocus=show;button.onmouseleave=leave;button.onblur=leave;
  }
  hideTooltip(){clearTimeout(this.hoverTimer);clearTimeout(this.leaveTimer);this.tooltipGeneration++;this.tooltip?.remove();this.tooltip=null;}
  genericTooltip(ctx,id){const a=GENERICS[id],cost=actionCost(ctx.actor,id);return `<header>${icon(id)}<h2>${a.name}</h2><small>Common action</small></header><div class="bg3-tooltip-description"><p>${a.description}</p></div><footer><i class="${cost}">●</i> ${cost==='attack'?'One attack':cost==='bonus'?'Bonus action':'Action'}</footer>`;}
  async itemTooltip(ctx,item,resource=false,selectedActivity=null){
    if(!item)return '';const system=item.system,activities=selectedActivity?[selectedActivity]:usableActivities(item),a=activities[0];
    const description=await foundry.applications.ux.TextEditor.implementation.enrichHTML([selectedActivity?.description?.chatFlavor,system.description?.value].filter(Boolean).join('<hr>'),{async:true,secrets:ctx.actor.isOwner,relativeTo:item,rollData:ctx.actor.getRollData()});
    const facts=[];if(a?.range?.value)facts.push(`${a.range.value} ${label(CONFIG.DND5E.distanceUnits?.[a.range.units]??a.range.units)}`);if(a?.duration?.value)facts.push(`${a.duration.value} ${label(CONFIG.DND5E.timePeriods?.[a.duration.units]??a.duration.units)}`);
    for(const activity of activities){if(activity.labels?.toHit)facts.push(`${activity.labels.toHit} to hit`);if(activity.save?.dc?.value)facts.push(`DC ${activity.save.dc.value} ${[...(activity.save.ability??[])].map(k=>label(CONFIG.DND5E.abilities[k])).join(' / ')} save`);for(const damage of activity.labels?.damages??[])facts.push(`${damage.formula??''} ${damage.damageType??''}`.trim());}
    if(system.properties?.has?.('concentration'))facts.push('Concentration');if(system.properties?.has?.('ritual'))facts.push('Ritual');if(selectedActivity&&activityUses(selectedActivity))facts.push(`${activityUses(selectedActivity)} activity uses`);else if(usesBadge(item))facts.push(`${usesBadge(item)} uses`);if(Number(system.quantity)>1)facts.push(`Quantity ${system.quantity}`);
    const state=itemState(item,selectedActivity,ctx.actor);
    const subtitle=item.type==='spell'?`${system.level?'Level '+system.level:'Cantrip'} ${label(CONFIG.DND5E.spellSchools?.[system.school])}`:label(CONFIG.Item.typeLabels?.[item.type]??item.type);
    return `<header><img src="${esc(selectedActivity?.img||item.img)}" alt=""><h2>${esc(selectedActivity?.name??item.name)}</h2><small>${selectedActivity?`${esc(item.name)} · `:''}${esc(subtitle)}</small></header>${state.reasons.length?`<div class="bg3-unavailable-reason">${state.reasons.map(esc).join('<br>')}</div>`:''}<div class="bg3-tooltip-description">${description||'<p>No description provided.</p>'}</div>${facts.length?`<div class="bg3-tooltip-facts">${facts.map(f=>`<span>${esc(f)}</span>`).join('')}</div>`:''}${activities.length>1?`<div class="bg3-tooltip-facts">${activities.map(a=>`<span>${esc(a.name)}</span>`).join('')}</div>`:''}<footer><i class="${a?.activation?.type??'action'}">●</i> ${esc(label(CONFIG.DND5E.activityActivationTypes?.[a?.activation?.type]??a?.activation?.type??'Use item'))}${item.type==='spell'&&system.level>0&&!usesBadge(item)?` · Level ${system.level} spell slot`:''}<small>${selectedActivity?'Click to use this activity':activities.length>1&&!resource?'Click to choose an activity · Right-click to change this slot':resource==='class'?'Right-click to open feature':resource?'Right-click to configure this resource':'Right-click to change this slot'}</small></footer>`;
  }
}
