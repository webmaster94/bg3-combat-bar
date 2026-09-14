import {itemState} from './item-state.js';
import {escapeHTML as esc} from './model.js';

export function usableActivities(item){return Array.from(item?.system?.activities??[]).filter(a=>a.canUse).sort((a,b)=>(a.sort??0)-(b.sort??0));}
export function activityUses(activity){const u=activity.uses,max=Number(u?.max);return max>0?`${u.value??Math.max(0,max-Number(u.spent??0))}/${max}`:'';}

export class ActivityPopover{
  constructor(bar){this.bar=bar;}
  close({focus=false}={}){
    this.element?.remove();this.element=null;this.bar.hideTooltip();
    document.removeEventListener('pointerdown',this.outside,true);document.removeEventListener('keydown',this.keydown,true);
    this.anchor?.setAttribute('aria-expanded','false');if(focus&&this.anchor?.isConnected)this.anchor.focus();this.anchor=null;
  }
  open(ctx,item,anchor){
    if(this.element&&this.anchor===anchor){this.close({focus:true});return;}
    this.close();this.anchor=anchor;anchor.setAttribute('aria-expanded','true');
    const activities=usableActivities(item),pop=this.element=document.createElement('aside');
    pop.className='bg3-activity-popover';pop.setAttribute('role','dialog');pop.setAttribute('aria-label',`${item.name} activities`);
    const columns=Math.min(6,activities.length),scale=this.bar.root.getBoundingClientRect().width/this.bar.root.offsetWidth;
    pop.style.setProperty('--activity-columns',columns);pop.style.setProperty('--activity-size',`${42*scale}px`);
    pop.innerHTML=`<header><span>${esc(item.name)}</span><button type="button" data-close-activities aria-label="Close activities">×</button></header><div class="bg3-activity-grid">${activities.map(a=>{const state=itemState(item,a,ctx.actor);return `<button type="button" class="bg3-slot ${state.unavailable?'is-unavailable':''}" data-activity-id="${esc(a.id)}" aria-label="${esc(a.name)}"><img src="${esc(a.img||item.img)}" alt="">${state.badge?`<span class="bg3-uses">${esc(state.badge)}</span>`:''}<span class="bg3-cost ${esc(a.activation?.type??'')}"></span></button>`;}).join('')}</div>`;
    document.body.append(pop);
    const rect=anchor.getBoundingClientRect(),box=pop.getBoundingClientRect();
    pop.style.left=`${Math.max(8,Math.min(innerWidth-box.width-8,rect.left+rect.width/2-box.width/2))}px`;
    pop.style.top=`${Math.max(8,rect.top-box.height-10)}px`;
    pop.style.setProperty('--activity-pointer',`${Math.max(14,Math.min(box.width-14,rect.left+rect.width/2-parseFloat(pop.style.left)))}px`);
    pop.querySelector('[data-close-activities]').onclick=()=>this.close({focus:true});
    pop.querySelectorAll('[data-activity-id]').forEach(button=>{
      const activity=activities.find(a=>a.id===button.dataset.activityId);
      this.bar.hover(button,()=>this.bar.itemTooltip(ctx,item,false,activity));
      button.onclick=async event=>{this.close();try{await this.bar.useActivity(ctx,activity,event);}catch(error){console.error('bg3-combat-bar | activity',error);ui.notifications.error(error.message);}};
    });
    this.outside=event=>{if(!pop.contains(event.target)&&!anchor.contains(event.target)&&!this.bar.tooltip?.contains(event.target))this.close();};
    this.keydown=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.close({focus:true});return;}
      const buttons=Array.from(pop.querySelectorAll('[data-activity-id]')),index=buttons.indexOf(document.activeElement);
      if(index<0||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns}[event.key];buttons[(index+delta+buttons.length)%buttons.length].focus();
    };
    document.addEventListener('pointerdown',this.outside,true);document.addEventListener('keydown',this.keydown,true);
    pop.querySelector('[data-activity-id]')?.focus();
  }
}
