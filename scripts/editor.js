import {SECTION_COLUMNS as C,escapeHTML as esc,matchesItem} from './model.js';
import {layout,editLayout} from './state.js';
import {choose,confirm} from './dialogs.js';
import {sectionName,characterPreferences} from './sections.js';
import {slotKey,groupsFor,expandGroups,addGroup,ungroup,removeSlots,planTransfer,applyTransfer,groupBounds,rowGeometry} from './groups.js';

export class BarEditor{
  constructor(bar){this.bar=bar;this.active=false;this.selected=[];}
  reset(){this.active=false;this.selected=[];this.renameId=null;this.closeMenu();this.endDrag();}
  sync(ctx,data){
    const key=`${ctx.document.uuid}:${data.page}`;
    if(this.key!==key){this.selected=[];this.renameId=null;this.closeMenu();}this.key=key;
    if(data.locked){this.active=false;this.selected=[];}
    this.closeMenu();
  }
  preferences(ctx){return characterPreferences(ctx,{editSlots:()=>{this.active=true;this.selected=[];this.bar.schedule();}});}
  toggle(ctx,ref){
    const refs=expandGroups(layout(ctx),[ref]),keys=new Set(refs.map(slotKey)),selected=new Set(this.selected.map(slotKey));
    this.selected=refs.every(r=>selected.has(slotKey(r)))?this.selected.filter(r=>!keys.has(slotKey(r))):expandGroups(layout(ctx),[...this.selected,...refs]);
    this.paint();
  }
  paint(){
    const keys=new Set(this.selected.map(slotKey));this.bar.root?.classList.toggle('is-editing',this.active);
    this.bar.root?.querySelectorAll('[data-slot]').forEach(b=>{const selectable=!['melee','ranged'].includes(b.dataset.slot.split(':')[0]);b.classList.toggle('is-selected',keys.has(b.dataset.slot));b.draggable=!!b.dataset.item||(this.active&&keys.has(b.dataset.slot));if(selectable&&this.active)b.setAttribute('aria-pressed',String(keys.has(b.dataset.slot)));else b.removeAttribute('aria-pressed');});
  }
  decorate(ctx,data,section){
    const groups=groupsFor(data).filter(g=>g.section===section.dataset.section),geometry=rowGeometry(groups,data.rows);
    const grid=section.querySelector('.bg3-grid'),viewport=section.querySelector('.bg3-viewport');if(!grid)return;
    viewport.style.height=`${geometry.height}px`;grid.style.height=`${geometry.height}px`;
    grid.querySelectorAll('.bg3-slot-wrap').forEach((el,i)=>{el.style.left=`${i%C*44}px`;el.style.top=`${geometry.slotTop(Math.floor(i/C))}px`;});
    for(const group of groups){
      const b=groupBounds(group.slots);if(b.row>=data.rows)continue;
      const frame=document.createElement('div');frame.className='bg3-group-frame';frame.style.cssText=`left:${b.col*44}px;top:${geometry.slotTop(b.row)}px;width:${(b.lastCol-b.col+1)*44-2}px;height:${geometry.slotTop(b.lastRow)-geometry.slotTop(b.row)+42}px`;grid.append(frame);
      const title=document.createElement('div');title.className='bg3-group-title';title.style.cssText=`left:${b.col*44}px;top:${geometry.titleTop(b.row)}px;width:${(b.lastCol-b.col+1)*44-2}px`;
      title.innerHTML=`<span title="${esc(group.name)}">${esc(group.name)}</span>${data.locked?'':`<button type="button" aria-label="Rename ${esc(group.name)}"><i class="fa-solid fa-pencil" inert></i></button>`}`;
      title.querySelector('button')?.addEventListener('click',()=>this.rename(ctx,group.id,title));grid.append(title);
      if(this.renameId===group.id&&!data.locked)this.rename(ctx,group.id,title);
    }
  }
  rename(ctx,id,title){
    const data=layout(ctx),group=groupsFor(data).find(g=>g.id===id);if(!group||data.locked)return;
    if(this.renameId!==id){this.renameId=id;this.titleDraft=group.name;}
    title.innerHTML=`<input aria-label="Group title" value="${esc(this.titleDraft)}" maxlength="40">`;
    const input=title.querySelector('input');input.focus();input.select();
    input.oninput=()=>this.titleDraft=input.value;
    input.onkeydown=async e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();this.renameId=null;await editLayout(ctx,d=>{const g=d.groups?.find(g=>g.id===id);if(g)g.name=input.value.trim().slice(0,40)||'Group';});this.bar.schedule();}else if(e.key==='Escape'){e.preventDefault();this.renameId=null;this.bar.schedule();}};
  }
  closeMenu(){this.menu?.remove();this.menu=null;this.menuAbort?.abort();}
  menuAt(ctx,ref,event){
    event.preventDefault();this.bar.hideTooltip();this.closeMenu();
    if(!this.selected.some(r=>slotKey(r)===slotKey(ref)))this.selected=expandGroups(layout(ctx),[ref]);this.paint();
    const menu=this.menu=document.createElement('div');menu.className='bg3-selection-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Selected slots');
    menu.innerHTML=[['group','Group'],['ungroup','Ungroup'],['send','Send To…'],['remove','Remove'],['clear','Clear Selection'],['done','Finish Editing']].map(([key,label])=>`<button role="menuitem" data-edit-command="${key}">${label}</button>`).join('');
    document.body.append(menu);const box=menu.getBoundingClientRect();menu.style.left=`${Math.max(0,Math.min(event.clientX,innerWidth-box.width-8))}px`;menu.style.top=`${Math.max(0,Math.min(event.clientY,innerHeight-box.height-8))}px`;
    menu.querySelectorAll('button').forEach(b=>b.onclick=async()=>{const refs=[...this.selected];this.closeMenu();try{await this.command(ctx,b.dataset.editCommand,refs);}catch(e){ui.notifications.warn(e.message);}});
    const abort=this.menuAbort=new AbortController();document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))this.closeMenu();},{signal:abort.signal});
    menu.onkeydown=e=>{if(e.key==='Escape'){this.closeMenu();e.stopPropagation();}};menu.querySelector('button').focus();
  }
  async command(ctx,command,refs){
    if(layout(ctx).locked)return;
    if(command==='clear'||command==='done'){this.selected=[];if(command==='done')this.active=false;this.bar.schedule();return;}
    if(command==='group'){
      const id=foundry.utils.randomID();await editLayout(ctx,d=>addGroup(d,refs,'New Group',id));this.renameId=id;this.titleDraft='New Group';
    }else if(command==='ungroup')await editLayout(ctx,d=>ungroup(d,refs));
    else if(command==='remove'){await editLayout(ctx,d=>removeSlots(d,refs));this.selected=[];}
    else if(command==='send'){
      const data=layout(ctx),pick=await choose('Send To…',`<label>Destination page<select name="page">${data.pages.map((_p,i)=>i===data.page?'':`<option value="${i}">Page ${i+1}</option>`).join('')}</select></label><p>Selected slots keep their section, row, and column.</p>`,[{value:'send',label:'Send'},{value:'cancel',label:'Cancel'}]);
      if(pick?.button==='send')await this.transfer(ctx,refs,{page:Number(pick.data.get('page'))});
    }
    this.bar.schedule();
  }
  async transfer(ctx,refs,target){
    await editLayout(ctx,async d=>{
      const plan=planTransfer(d,refs,target);
      for(const e of plan.entries)if(e.itemId&&!matchesItem(ctx.actor.items.get(e.itemId),e.to.section))throw Error('One or more icons do not fit the destination section.');
      if(plan.collisions.length){
        const names=plan.collisions.map(r=>`<li>${esc(ctx.actor.items.get(r.itemId)?.name??'Missing item')} · ${esc(sectionName(r.section,ctx))}, row ${Math.floor(r.index/C)+1}, column ${r.index%C+1}</li>`).join('');
        if(!await confirm('Replace assigned icons?',`<p>Moving to page ${plan.page+1} will displace these assignments:</p><ul>${names}</ul><p>The items remain on the character sheet.</p>`,'Replace Icons'))return;
      }
      applyTransfer(d,plan);this.selected=[];
    });
  }
  startDrag(ctx,button,event){
    const [section,index]=button.dataset.slot.split(':'),ref={section,index:Number(index)},data=layout(ctx);
    this.closeMenu();this.bar.hideTooltip();this.bar.activities.close();
    const weapon=['melee','ranged'].includes(section);
    const refs=weapon?[ref]:expandGroups(data,this.active&&this.selected.some(r=>slotKey(r)===slotKey(ref))?this.selected:[ref]);
    if(!button.dataset.item&&!refs.some(r=>data.pages[data.page]?.[r.section]?.[r.index]))return event.preventDefault();
    this.endDrag();const drag=this.drag={ctx,page:data.page,refs,anchor:ref,weapon,loadout:Number(button.dataset.loadoutIndex),handled:false};
    event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',JSON.stringify({type:'Item',uuid:ctx.actor.items.get(button.dataset.item)?.uuid,bg3:{owner:ctx.document.uuid,page:data.page,slot:button.dataset.slot,loadout:button.dataset.loadoutIndex}}));
    const abort=this.dragAbort=new AbortController();
    document.addEventListener('dragover',e=>{if(!this.bar.root?.contains(e.target)){e.preventDefault();e.dataTransfer.dropEffect='move';}},{capture:true,signal:abort.signal});
    document.addEventListener('drop',e=>{
      if(this.bar.root?.contains(e.target))return;e.preventDefault();e.stopPropagation();drag.handled=true;
      this.removeDragged(drag).catch(error=>ui.notifications.warn(error.message));this.endDrag();
    },{capture:true,signal:abort.signal});
    button.ondragend=()=>this.endDrag(); // Escape and rejected drops never remove assignments.
  }
  async removeDragged(drag){
    if(!drag.ctx.actor.isOwner)return;
    await editLayout(drag.ctx,d=>{if(drag.weapon)d.weapons[drag.anchor.section][drag.loadout][drag.anchor.index]=null;else removeSlots(d,drag.refs,drag.page);});
    this.selected=[];this.bar.schedule();
  }
  async drop(ctx,button,event){
    const drag=this.drag;if(!drag||drag.ctx.document.uuid!==ctx.document.uuid)return false;
    event.preventDefault();event.stopPropagation();drag.handled=true;
    if(layout(ctx).locked){this.endDrag();return true;}
    const [section,index]=button.dataset.slot.split(':');
    if(!drag.weapon&&!['melee','ranged'].includes(section)){
      if(layout(ctx).page!==drag.page){this.endDrag();throw Error('The page changed during dragging. Try again.');}
      const grouped=groupsFor(layout(ctx)).some(g=>g.slots.some(i=>drag.refs.some(r=>r.section===g.section&&r.index===i)));
      if(drag.refs.length>1||grouped){await this.transfer(ctx,drag.refs,{anchor:drag.anchor,destination:{section,index:Number(index)}});this.endDrag();return true;}
    }
    this.endDrag();return false; // Preserve the ordinary one-slot swap behavior.
  }
  endDrag(){this.dragAbort?.abort();this.dragAbort=null;this.drag=null;}
}
