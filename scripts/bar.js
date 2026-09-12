import {ID,SECTIONS,GENERICS,escapeHTML as esc,newPage,matchesItem,usesBadge} from "./model.js";
import {layout,editLayout,economy,actionCost,isTurn,equipLoadout,serial} from "./state.js";
import {choose,pickItem,confirm} from "./dialogs.js";
import {generic,requestGM,clearHidden} from "./actions.js";

const icon = (name,cls="") => `<img class="bg3-generic-icon ${cls}" src="modules/${ID}/assets/${name}.svg" alt="">`;
const label = value => game.i18n.localize(value?.label ?? value ?? "");
export class CombatBar {
  constructor(){this.ctx=null;this.macroMode=false;this.tooltipGeneration=0;this.busy=false;this.renderQueued=false;}
  schedule(){if(this.renderQueued)return;this.renderQueued=true;requestAnimationFrame(()=>{this.renderQueued=false;this.render();});}
  setContext(ctx){if(this.ctx?.token?.uuid!==ctx?.token?.uuid)this.hideTooltip();this.ctx=ctx;this.schedule();}
  visible(){return this.ctx?.actor?.isOwner && ["character","npc"].includes(this.ctx.actor.type) && (game.combat?.started||game.settings.get(ID,"outsideCombat"));}
  render(){
    this.root?.remove();this.swap?.remove();this.hideTooltip();
    const visible=this.visible();document.body.classList.toggle("bg3-replaces-hotbar",!!visible&&!this.macroMode);
    if(!visible)return;
    if(this.macroMode){this.swap=document.createElement("button");this.swap.className="bg3-return";this.swap.title="Return to BG3 Combat Bar";this.swap.innerHTML=`${icon("swords")} Combat bar`;this.swap.onclick=()=>{this.macroMode=false;this.render();};document.body.append(this.swap);return;}
    const ctx=this.ctx,data=layout(ctx),actor=ctx.actor,hp=actor.system.attributes.hp,frac=Math.max(0,Math.min(1,(hp.value??0)/(hp.max||1)));
    const root=this.root=document.createElement("section");root.id="bg3-combat-bar";root.setAttribute("aria-label",`BG3 Combat Bar: ${actor.name}`);
    root.classList.toggle("is-locked",data.locked);root.style.setProperty("--bg3-scale",game.settings.get(ID,"scale"));
    root.style.setProperty("--offset-x",`${data.offset.x}px`);root.style.setProperty("--offset-y",`${data.offset.y}px`);
    root.innerHTML=`<div class="bg3-upper"><button class="bg3-drag-bar" data-command="move" aria-label="Drag combat bar" title="Drag the bar when unlocked">◆</button><span class="bg3-actor-name">${esc(actor.name)}</span><div class="bg3-resources" data-resource-drop>${this.resources(ctx,data)}</div></div>
      <div class="bg3-main"><div class="bg3-portrait-wrap"><button class="bg3-portrait" data-command="sheet" title="Open character sheet" style="--hp:${frac*100}%;--damage:${(1-frac)*100}%"><img src="${esc(actor.img)}" alt="${esc(actor.name)}"><span class="bg3-health-fill"></span><span class="bg3-health">${hp.value??0}<small> / ${hp.max??0}</small></span>${hp.temp>0?`<span class="bg3-temp">+${hp.temp}</span>`:""}</button><button class="bg3-checks" data-command="checks" aria-label="Skills and saving throws" title="Skills and saving throws">${icon("d20")}</button></div>
      <div class="bg3-sections">${data.order.map(section=>section==="weapons"?this.weapons(ctx,data):this.section(ctx,data,section)).join("")}</div>
      <nav class="bg3-controls" aria-label="Bar controls"><button data-command="macros" title="Show Foundry macro bar" aria-label="Show Foundry macro bar">▦</button><button data-command="previous" aria-label="Previous page" title="Previous page">▴</button><span>${data.page+1}/${data.pages.length}</span><button data-command="next" aria-label="Next page" title="Next page">▾</button><button data-command="addPage" aria-label="Add page" title="Add page">+</button><button data-command="deletePage" aria-label="Remove current page" title="Remove current page">−</button><button data-command="lock" aria-label="${data.locked?"Unlock":"Lock"} bar" title="${data.locked?"Unlock":"Lock"} bar"><i class="fa-solid ${data.locked?"fa-lock":"fa-unlock"}"></i></button></nav>
      <button class="bg3-end-turn ${isTurn(ctx)?"is-turn":""}" data-command="endTurn" ${isTurn(ctx)?"":"disabled"} aria-label="End turn">${icon("hourglass")}<small>End turn</small></button><button class="bg3-rest" data-command="rest" title="Short or long rest" aria-label="Rest">${icon("rest")}</button></div>`;
    document.body.append(root);this.bind(ctx,data);
  }
  resources(ctx,data){
    const e=economy(ctx),spells=ctx.actor.system.spells??{};
    let html=`<button class="bg3-resource action ${e.action?'':'spent'}" data-economy="action" title="Action · click to spend, right-click to restore"><i>●</i><span>${e.action}</span></button><button class="bg3-resource bonus ${e.bonus?'':'spent'}" data-economy="bonus" title="Bonus action · click to spend, right-click to restore"><i>▲</i><span>${e.bonus}</span></button>`;
    if(e.attacks>0)html+=`<span class="bg3-resource attacks" title="Attacks remaining in your Attack action">⚔ ${e.attacks}</span>`;
    for(const [key,spell] of Object.entries(spells)){
      if(!(Number(spell.max)>0))continue;
      html+=`<span class="bg3-resource spell" title="${key==='pact'?'Pact slots':`Level ${key.replace('spell','')}`} · ${spell.value}/${spell.max}"><small>${key==='pact'?'P':key.replace('spell','')}</small><span class="bg3-pips">${Array.from({length:Math.min(12,spell.max)},(_,i)=>`<i class="${i<spell.value?'':'spent'}">◆</i>`).join('')}</span></span>`;
    }
    for(const [i,r] of data.resources.entries()){
      const item=r.itemId?ctx.actor.items.get(r.itemId):null;
      const text=item?usesBadge(item):`${r.value??r.max}/${r.max}`;
      html+=`<button class="bg3-resource custom" data-custom="${i}" title="${esc(item?.name??r.name)} · click to use, right-click to configure">${item?`<img src="${esc(item.img)}" alt="">`:'<i>✦</i>'}<small>${esc(item?.name??r.name)}</small><span>${esc(text||'—')}</span></button>`;
    }
    return html+`<button class="bg3-add-resource" data-command="resource" aria-label="Add custom resource" title="Add resource, or drop a limited-use feature here">+</button>`;
  }
  weapons(ctx,data){
    const type=data.weaponTab,index=data.weaponSet[type];
    return `<section class="bg3-section bg3-weapons" data-section="weapons"><header draggable="${!data.locked}" data-section-drag="weapons"><span>Weapons</span></header><div class="bg3-weapon-tabs"><button data-weapon-type="melee" class="${type==='melee'?'active':''}" title="Melee loadouts">${icon('swords')}</button><button data-weapon-type="ranged" class="${type==='ranged'?'active':''}" title="Ranged loadouts">${icon('bow')}</button></div><div class="bg3-weapon-slots">${data.weapons[type][index].map((id,hand)=>this.slot(ctx,id,{section:type,index:hand,loadout:index,weapon:true,hand})).join('')}</div><div class="bg3-loadouts">${[0,1].map(i=>`<button data-loadout="${i}" class="${index===i?'active':''}" title="Equip ${type} loadout ${i+1}">${i+1===1?'I':'II'}</button>`).join('')}<small>${data.activeLoadout?.type===type&&data.activeLoadout?.index===index?'Equipped':'Stored'}</small></div></section>`;
  }
  section(ctx,data,section){
    const n=data.widths[section]??SECTIONS[section],slots=data.pages[data.page][section];
    return `<section class="bg3-section bg3-${section}" data-section="${section}"><header draggable="${!data.locked}" data-section-drag="${section}"><span>${section==='features'?'Actions & features':section==='spells'?'Spells':'Items'}</span><button data-resize="${section}" title="Change section width" aria-label="Change ${section} width">↔</button></header>${section==='features'?`<div class="bg3-generics">${Object.entries(GENERICS).map(([id,a])=>`<button class="bg3-slot bg3-generic" data-generic="${id}" aria-label="${a.name}">${icon(id)}<span class="bg3-cost ${actionCost(ctx.actor,id)}"></span></button>`).join('')}</div>`:''}<div class="bg3-grid" style="--columns:${Math.max(2,n/2)}">${slots.map((id,index)=>this.slot(ctx,id,{section,index})).join('')}</div></section>`;
  }
  slot(ctx,id,{section,index,loadout,weapon=false,hand=0}){
    const item=ctx.actor.items.get(id),name=item?.name??(weapon?`${hand?'Off hand':'Main hand'} ${section}`:`Add ${section==='features'?'feature':section==='spells'?'spell':'item'}`);
    const badge=usesBadge(item);
    return `<div class="bg3-slot-wrap"><button class="bg3-slot ${item?'filled':'empty'}" data-slot="${section}:${index}" data-item="${esc(item?.id??'')}" ${weapon?`data-loadout-index="${loadout}"`:''} draggable="${!!item&&!layout(ctx).locked}" aria-label="${esc(name)}">${item?`<img src="${esc(item.img)}" alt="">`:`<span class="bg3-empty-icon">${weapon?(hand?'Ⅱ':'Ⅰ'):'+'}</span>`}${badge?`<span class="bg3-uses">${esc(badge)}</span>`:''}${item?.system?.level?`<span class="bg3-level">${item.system.level}</span>`:''}</button><button class="bg3-assign" data-assign="${section}:${index}" ${weapon?`data-loadout-index="${loadout}"`:''} title="Choose ${esc(name)}" aria-label="Choose ${esc(name)}">⌄</button></div>`;
  }
  bind(ctx,data){
    const root=this.root;
    const run=fn=>async e=>{try{await fn(e);}catch(error){console.error(`${ID} |`,error);ui.notifications.error(error.message);}};
    root.querySelectorAll('[data-command]').forEach(b=>b.onclick=run(e=>this.command(b.dataset.command,ctx,data,e)));
    root.querySelectorAll('[data-generic]').forEach(b=>{b.onclick=run(()=>serial(`${ctx.token.uuid}:barUse`,()=>generic(ctx,b.dataset.generic)));this.hover(b,()=>this.genericTooltip(ctx,b.dataset.generic));});
    root.querySelectorAll('[data-slot]').forEach(b=>{
      b.onclick=run(e=>b.dataset.item&&!e.altKey?this.useItem(ctx,ctx.actor.items.get(b.dataset.item),e):this.assign(ctx,b));
      b.oncontextmenu=run(e=>{e.preventDefault();return this.assign(ctx,b);});
      if(b.dataset.item)this.hover(b,()=>this.itemTooltip(ctx,ctx.actor.items.get(b.dataset.item)));
      b.ondragstart=e=>{if(data.locked){e.preventDefault();return;}e.dataTransfer.setData('text/plain',JSON.stringify({type:'Item',uuid:ctx.actor.items.get(b.dataset.item)?.uuid,bg3:{owner:ctx.document.uuid,page:data.page,slot:b.dataset.slot,loadout:b.dataset.loadoutIndex}}));this.hideTooltip();};
      b.ondragover=e=>{if(!data.locked){e.preventDefault();b.classList.add('drop-target');}};
      b.ondragleave=()=>b.classList.remove('drop-target');
      b.ondrop=run(async e=>{e.preventDefault();e.stopPropagation();b.classList.remove('drop-target');if(data.locked)return;let drop;try{drop=JSON.parse(e.dataTransfer.getData('text/plain'));}catch{return;}if(drop.type!=='Item')return;const item=await fromUuid(drop.uuid);if(item?.actor?.uuid!==ctx.actor.uuid)throw new Error("Drag an item from this character's sheet.");await this.assignItem(ctx,b,item.id,drop.bg3);});
    });
    root.querySelectorAll('[data-assign]').forEach(b=>b.onclick=run(()=>this.assign(ctx,b)));
    root.querySelectorAll('[data-weapon-type]').forEach(b=>b.onclick=run(()=>editLayout(ctx,d=>{d.weaponTab=b.dataset.weaponType;})));
    root.querySelectorAll('[data-loadout]').forEach(b=>b.onclick=run(()=>editLayout(ctx,d=>equipLoadout(ctx,d,d.weaponTab,Number(b.dataset.loadout)))));
    root.querySelectorAll('[data-resize]').forEach(b=>b.onclick=run(()=>{if(data.locked)return;return editLayout(ctx,d=>{const key=b.dataset.resize;d.widths[key]=d.widths[key]>=SECTIONS[key]?4:d.widths[key]+2;});}));
    root.querySelectorAll('[data-section-drag]').forEach(h=>h.ondragstart=e=>{if(data.locked)return e.preventDefault();e.dataTransfer.setData('text/plain',JSON.stringify({bg3Section:h.dataset.sectionDrag}));});
    root.querySelectorAll('[data-section]').forEach(s=>{s.ondragover=e=>{if(!data.locked)e.preventDefault();};s.ondrop=run(async e=>{if(data.locked)return;e.preventDefault();let value;try{value=JSON.parse(e.dataTransfer.getData('text/plain'));}catch{return;}if(!data.order.includes(value.bg3Section))return;await editLayout(ctx,d=>{d.order=d.order.filter(k=>k!==value.bg3Section);d.order.splice(d.order.indexOf(s.dataset.section),0,value.bg3Section);});});});
    root.querySelectorAll('[data-economy]').forEach(b=>{const change=restore=>run(()=>serial(`${ctx.document.uuid}:economy`,()=>{const state=economy(ctx);state[b.dataset.economy]=restore?1:0;return ctx.document.setFlag(ID,'economy',state);}));b.onclick=change(false);b.oncontextmenu=e=>{e.preventDefault();change(true)(e);};});
    root.querySelectorAll('[data-custom]').forEach(b=>{b.onclick=run(()=>this.useResource(ctx,Number(b.dataset.custom)));b.oncontextmenu=run(e=>{e.preventDefault();return this.configureResource(ctx,Number(b.dataset.custom));});});
    const resources=root.querySelector('[data-resource-drop]');resources.ondragover=e=>{if(!data.locked)e.preventDefault();};resources.ondrop=run(async e=>{e.preventDefault();if(data.locked)return;let drop;try{drop=JSON.parse(e.dataTransfer.getData('text/plain'));}catch{return;}const item=drop.uuid?await fromUuid(drop.uuid):null;if(item?.actor?.uuid!==ctx.actor.uuid||!usesBadge(item))throw new Error("Drop a limited-use item or feature from this character.");await editLayout(ctx,d=>{if(!d.resources.some(r=>r.itemId===item.id))d.resources.push({itemId:item.id});});});
    const grip=root.querySelector('[data-command="move"]');grip.onpointerdown=e=>{
      if(data.locked||e.button!==0)return;e.preventDefault();grip.setPointerCapture(e.pointerId);const start={x:e.clientX,y:e.clientY};let offset={...data.offset};
      grip.onpointermove=ev=>{offset={x:Math.max(-innerWidth/2+100,Math.min(innerWidth/2-100,data.offset.x+ev.clientX-start.x)),y:Math.max(-innerHeight+220,Math.min(0,data.offset.y+ev.clientY-start.y))};root.style.setProperty('--offset-x',`${offset.x}px`);root.style.setProperty('--offset-y',`${offset.y}px`);};
      grip.onpointerup=run(async()=>{grip.onpointermove=null;grip.onpointerup=null;await editLayout(ctx,d=>{d.offset=offset;});});
    };
  }
  async assign(ctx,button){if(layout(ctx).locked)return ui.notifications.info("Unlock the bar to change slots.");const [section,index]=(button.dataset.slot??button.dataset.assign).split(':');const id=await pickItem(ctx,`${section[0].toUpperCase()+section.slice(1)} · choose a slot item`,item=>matchesItem(item,section,Number(index)));if(id===undefined)return;await this.assignItem(ctx,button,id);}
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
  async useItem(ctx,item,event){if(!item)return;return serial(`${ctx.token.uuid}:barUse`,async()=>{this.usingActor=ctx.actor.uuid;try{return await item.use({event});}finally{this.usingActor=null;}});}
  async command(command,ctx,data,event){
    if(command==='sheet')return ctx.actor.sheet.render(true);
    if(command==='macros'){this.macroMode=true;return this.render();}
    if(command==='checks')return this.checks(ctx);
    if(command==='lock')return editLayout(ctx,d=>{d.locked=!d.locked;});
    if(command==='previous'||command==='next')return editLayout(ctx,d=>{d.page=(d.page+(command==='next'?1:-1)+d.pages.length)%d.pages.length;});
    if(command==='addPage'){if(data.locked)return;if(data.pages.length>=12)throw new Error("The bar supports up to 12 pages.");return editLayout(ctx,d=>{d.pages.push(newPage());d.page=d.pages.length-1;});}
    if(command==='deletePage'){if(data.locked||data.pages.length===1)return;if(!await confirm('Remove page',`<p>Remove page ${data.page+1} and its slot assignments?</p>`,'Remove page'))return;return editLayout(ctx,d=>{d.pages.splice(d.page,1);d.page=Math.min(d.page,d.pages.length-1);});}
    if(command==='endTurn'){if(isTurn(ctx))return game.user.isGM?game.combat.nextTurn():requestGM({action:'endTurn',source:ctx.token.uuid});return;}
    if(command==='rest'){const pick=await choose('Rest',`<p>${esc(ctx.actor.name)}</p>`,[{value:'short',label:'Short rest'},{value:'long',label:'Long rest'}]);if(!pick)return;return pick.button==='short'?ctx.actor.shortRest():ctx.actor.longRest();}
    if(command==='resource')return this.configureResource(ctx);
  }
  async checks(ctx){
    const actor=ctx.actor,abilities=Object.entries(CONFIG.DND5E.abilities),skills=Object.entries(CONFIG.DND5E.skills),signed=n=>Number(n)>=0?`+${n}`:n;
    const dialog=document.createElement('dialog');dialog.className='bg3-dialog bg3-check-dialog';
    dialog.innerHTML=`<header><h2>${esc(actor.name)}</h2><button data-close aria-label="Close">×</button></header><div class="bg3-check-columns"><section><h3>Saving throws</h3>${abilities.map(([key,a])=>`<button data-save="${key}"><span>${esc(label(a))}</span><b>${signed(actor.system.abilities[key]?.save?.value??actor.system.abilities[key]?.mod??0)}</b></button>`).join('')}</section><section><h3>Skills</h3>${skills.map(([key,s])=>`<button data-skill="${key}"><span>${actor.system.skills[key]?.proficient?'◆ ':''}${esc(label(s))}</span><b>${signed(actor.system.skills[key]?.total??0)}</b></button>`).join('')}</section></div><footer>${actor.effects.some(e=>e.getFlag(ID,'kind')==='hide')?'<button data-reveal>End hiding</button>':''}${actor.effects.filter(e=>e.getFlag(ID,'kind')==='grapple').map(e=>`<button data-escape="${e.id}">Escape grapple · DC ${e.getFlag(ID,'dc')}</button>`).join('')}</footer>`;
    const close=()=>{dialog.close();dialog.remove();};dialog.querySelector('[data-close]').onclick=close;dialog.oncancel=close;
    dialog.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{close();actor.rollSavingThrow({ability:b.dataset.save});});dialog.querySelectorAll('[data-skill]').forEach(b=>b.onclick=()=>{close();actor.rollSkill({skill:b.dataset.skill});});
    dialog.querySelector('[data-reveal]')?.addEventListener('click',()=>{close();clearHidden(actor);});
    dialog.querySelectorAll('[data-escape]').forEach(b=>b.onclick=()=>{close();requestGM({action:'escape',source:ctx.token.uuid,effect:b.dataset.escape}).catch(e=>ui.notifications.error(e.message));});
    document.body.append(dialog);dialog.showModal();
  }
  async configureResource(ctx,index){
    const data=layout(ctx);if(data.locked)return;const r=data.resources[index]??{name:'Resource',max:3,value:3,reset:'long'};
    const items=ctx.actor.items.filter(i=>usesBadge(i));
    const result=await choose('Custom resource',`<label>Track<select name="item"><option value="">Custom counter</option>${items.map(i=>`<option value="${i.id}" ${r.itemId===i.id?'selected':''}>${esc(i.name)}</option>`).join('')}</select></label><label>Name<input name="name" value="${esc(r.name??'Resource')}" required maxlength="40"></label><div class="bg3-form-row"><label>Current<input name="value" type="number" min="0" max="999" value="${r.value??3}" required></label><label>Maximum<input name="max" type="number" min="1" max="999" value="${r.max??3}" required></label></div><label>Recover on<select name="reset"><option value="long" ${r.reset==='long'?'selected':''}>Long rest</option><option value="short" ${r.reset==='short'?'selected':''}>Short or long rest</option><option value="turn" ${r.reset==='turn'?'selected':''}>Start of turn</option><option value="manual" ${r.reset==='manual'?'selected':''}>Manual</option></select></label>`,[{value:'save',label:'Save'},...(index!==undefined?[{value:'remove',label:'Remove'}]:[])]);
    if(!result)return;await editLayout(ctx,d=>{if(result.button==='remove')d.resources.splice(index,1);else{const f=result.data;const next=f.get('item')?{itemId:f.get('item')}:{name:f.get('name'),value:Math.min(Number(f.get('value')),Number(f.get('max'))),max:Number(f.get('max')),reset:f.get('reset')};if(index===undefined)d.resources.push(next);else d.resources[index]=next;}});
  }
  async useResource(ctx,index){const r=layout(ctx).resources[index];if(r.itemId)return this.useItem(ctx,ctx.actor.items.get(r.itemId));return editLayout(ctx,d=>{d.resources[index].value=Math.max(0,(d.resources[index].value??d.resources[index].max)-1);});}
  hover(button,content){const show=()=>{clearTimeout(this.hoverTimer);this.hoverTimer=setTimeout(async()=>{const generation=++this.tooltipGeneration;const html=await content();if(generation!==this.tooltipGeneration||!button.isConnected)return;this.tooltip?.remove();const tip=this.tooltip=document.createElement('aside');tip.className='bg3-tooltip';tip.setAttribute('role','tooltip');tip.innerHTML=html;document.body.append(tip);const r=button.getBoundingClientRect(),t=tip.getBoundingClientRect();tip.style.left=`${Math.max(8,Math.min(innerWidth-t.width-8,r.left))}px`;tip.style.top=`${Math.max(8,r.top-t.height-14)}px`;tip.onmouseenter=()=>clearTimeout(this.leaveTimer);tip.onmouseleave=()=>this.hideTooltip();},250);};button.onmouseenter=show;button.onfocus=show;button.onmouseleave=()=>{clearTimeout(this.hoverTimer);this.leaveTimer=setTimeout(()=>this.hideTooltip(),180);};button.onblur=()=>this.hideTooltip();}
  hideTooltip(){clearTimeout(this.hoverTimer);clearTimeout(this.leaveTimer);this.tooltipGeneration++;this.tooltip?.remove();this.tooltip=null;}
  genericTooltip(ctx,id){const a=GENERICS[id],cost=actionCost(ctx.actor,id);return `<header>${icon(id)}<h2>${a.name}</h2><small>Common action</small></header><div class="bg3-tooltip-description"><p>${a.description}</p></div><footer><i class="${cost}">●</i> ${cost==='attack'?'One attack':cost==='bonus'?'Bonus action':'Action'}</footer>`;}
  async itemTooltip(ctx,item){
    if(!item)return '';const system=item.system,activities=Array.from(system.activities??[]),a=activities[0];
    const description=await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.description?.value??'',{async:true,secrets:ctx.actor.isOwner,relativeTo:item,rollData:ctx.actor.getRollData()});
    const facts=[];if(a?.range?.value)facts.push(`${a.range.value} ${label(CONFIG.DND5E.distanceUnits?.[a.range.units]??a.range.units)}`);if(a?.duration?.value)facts.push(`${a.duration.value} ${label(CONFIG.DND5E.timePeriods?.[a.duration.units]??a.duration.units)}`);
    for(const activity of activities){if(activity.labels?.toHit)facts.push(`${activity.labels.toHit} to hit`);if(activity.save?.dc?.value)facts.push(`DC ${activity.save.dc.value} ${[...(activity.save.ability??[])].map(k=>label(CONFIG.DND5E.abilities[k])).join(' / ')} save`);for(const damage of activity.labels?.damages??[])facts.push(`${damage.formula??''} ${damage.damageType??''}`.trim());}
    if(system.properties?.has?.('concentration'))facts.push('Concentration');if(system.properties?.has?.('ritual'))facts.push('Ritual');if(usesBadge(item))facts.push(`${usesBadge(item)} uses`);if(Number(system.quantity)>1)facts.push(`Quantity ${system.quantity}`);
    const subtitle=item.type==='spell'?`${system.level?'Level '+system.level:'Cantrip'} ${label(CONFIG.DND5E.spellSchools?.[system.school])}`:label(CONFIG.Item.typeLabels?.[item.type]??item.type);
    return `<header><img src="${esc(item.img)}" alt=""><h2>${esc(item.name)}</h2><small>${esc(subtitle)}</small></header><div class="bg3-tooltip-description">${description||'<p>No description provided.</p>'}</div>${facts.length?`<div class="bg3-tooltip-facts">${facts.map(f=>`<span>${esc(f)}</span>`).join('')}</div>`:''}${activities.length>1?`<div class="bg3-tooltip-facts">${activities.map(a=>`<span>${esc(a.name)}</span>`).join('')}</div>`:''}<footer><i class="${a?.activation?.type??'action'}">●</i> ${esc(label(CONFIG.DND5E.activityActivationTypes?.[a?.activation?.type]??a?.activation?.type??'Use item'))}${item.type==='spell'&&system.level>0&&!usesBadge(item)?` · Level ${system.level} spell slot`:''}<small>Right-click to change · Alt-click to choose</small></footer>`;
  }
}
