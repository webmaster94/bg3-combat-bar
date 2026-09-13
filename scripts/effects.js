import {ID,escapeHTML as esc} from './model.js';
import {EFFECT_SETTINGS,effectGrid,collectEffects,canEditEffect} from './effect-model.js';
const VAE='visual-active-effects';
export function registerEffectSettings(refresh){
  game.settings.register(ID,'effectScale',{name:'Docked effect icon scale (%)',hint:'Scale effect icons on the combat bar. 50% makes the default 50-pixel icons 25 pixels wide. Tooltip text is unchanged.',scope:'client',config:true,type:Number,default:50,range:{min:10,max:200,step:5},requiresReload:false,onChange:refresh});
  game.settings.register(ID,'showEffects',{name:'Show active effects on the bar',scope:'client',config:true,type:Boolean,default:true,requiresReload:false,onChange:refresh});
  for(const [key,setting] of Object.entries(EFFECT_SETTINGS))game.settings.register(ID,`effects.${key}`,{...setting,hint:`${setting.hint} When Visual Active Effects is active, its matching setting is used.`,config:true,requiresReload:false,onChange:refresh});
}
export function effectSettings(){
  const settings=Object.fromEntries(Object.entries(EFFECT_SETTINGS).map(([key,setting])=>{
    const inherited=game.modules.get(VAE)?.active&&game.settings.settings.has(`${VAE}.${key}`);
    return [key,inherited?game.settings.get(VAE,key):game.settings.get(ID,`effects.${key}`)??setting.default];
  }));
  settings.iconSize*=(game.settings.get(ID,'effectScale')??50)/100;
  return settings;
}
function duration(effect){
  if(!effect.isTemporary)return 'Passive';
  if(effect.duration?.expired)return 'Expired';
  if(effect.duration?.remaining===Infinity)return 'Unlimited';
  return effect.duration?.label||'Unlimited';
}
async function prepare(entry){
  const {effect}=entry,buttons=[];
  effect.updateDuration?.();
  Hooks.callAll(`${VAE}.createEffectButtons`,effect,buttons);
  let rollData={};
  try{let origin=effect.origin?fromUuidSync(effect.origin):null;if(origin?.documentName==='ActiveEffect')origin=origin.parent;if(origin?.inCompendium)origin=effect.parent;rollData=origin?.getRollData?.()??effect.parent?.getRollData?.()??{};}catch{}
  const intro=effect.description?await foundry.applications.ux.TextEditor.implementation.enrichHTML(effect.description,{async:true,relativeTo:effect,rollData,secrets:effect.isOwner}):'';
  const context={effect,strings:{intro,content:''},buttons,durationLabel:effect.isTemporary?duration(effect):'',hasText:!!intro,isExpired:!!effect.duration?.expired,isInfinite:effect.duration?.remaining===Infinity};
  if(Hooks.call(`${VAE}.prepareActiveEffectContext`,effect,context)===false)return null;
  context.buttons=context.buttons.filter(b=>typeof b.label==='string'&&typeof b.callback==='function');
  return {...entry,context};
}
export class EffectsDock{
  constructor(bar,ctx){this.bar=bar;this.ctx=ctx;this.root=bar.root;this.prefs=effectSettings();this.entries=[];}
  async render(){
    if(!game.settings.get(ID,'showEffects'))return;
    const entries=await Promise.all(collectEffects(this.ctx.actor,this.prefs,CONST.ACTIVE_EFFECT_SHOW_ICON).map(prepare));
    if(this.bar.root!==this.root||!this.root.isConnected)return;
    this.entries=entries.filter(Boolean);
    document.body.classList.add('bg3-docked-effects');
    if(!this.entries.length)return;
    const dock=this.element=document.createElement('div');dock.className='bg3-effects-dock';dock.setAttribute('role','group');dock.setAttribute('aria-label','Active effects');
    dock.style.setProperty('--effect-size',`${this.prefs.iconSize}px`);dock.style.setProperty('--effect-top',`${this.prefs.topOffset}px`);
    dock.innerHTML=this.entries.map(({effect,itemEffect},i)=>`<button class="bg3-effect ${effect.disabled?'is-disabled':''} ${itemEffect?'is-item-effect':''}" data-effect="${i}" aria-label="${esc(effect.name)}${effect.disabled?' (disabled)':''}"><span class="bg3-effect-image" aria-hidden="true"></span>${effect.isTemporary?`<i class="bg3-effect-clock fa-solid fa-clock ${effect.duration?.expired?'expired':''}" aria-hidden="true"></i>`:''}${effect.disabled?'<i class="bg3-effect-disabled fa-solid fa-ban" aria-hidden="true"></i>':''}</button>`).join('');
    this.root.querySelector('.bg3-main').append(dock);
    const run=fn=>async event=>{try{await fn(event);}catch(error){console.error(`${ID} | effects`,error);ui.notifications.error(error.message);}};
    dock.querySelectorAll('[data-effect]').forEach(button=>{
      const entry=this.entries[Number(button.dataset.effect)],effect=entry.effect;
      const icon=button.querySelector('.bg3-effect-image');
      icon.style.backgroundImage=icon.style.maskImage=`url(${JSON.stringify(effect.img)})`;
      if(!effect.disabled)icon.style.backgroundColor=effect.tint?.css||'#ffffff';
      this.bar.hover(button,()=>this.tooltip(entry),tip=>{
        tip.classList.add('bg3-effect-tooltip');tip.style.fontSize=`${this.prefs.fontSize}px`;
        tip.querySelectorAll('[data-effect-button]').forEach(b=>b.onclick=run(event=>entry.context.buttons[Number(b.dataset.effectButton)].callback(event)));
      });
      button.ondblclick=run(event=>{
        event.preventDefault();event.stopPropagation();if(!canEditEffect(effect,this.prefs,game.user))return;
        this.bar.hideTooltip();return event.ctrlKey||event.metaKey?effect.sheet.render({force:true}):effect.update({disabled:!effect.disabled});
      });
      button.oncontextmenu=run(event=>{
        event.preventDefault();event.stopPropagation();if(!canEditEffect(effect,this.prefs,game.user))return;
        this.bar.hideTooltip();return event.shiftKey&&game.user.isGM?effect.delete():effect.deleteDialog();
      });
    });
    this.layout();
  }
  tooltip({effect,itemEffect,context}){
    const allowed=canEditEffect(effect,this.prefs,game.user),source=effect.sourceName;
    return `<header><img src="${esc(effect.img)}" alt=""><h2>${esc(effect.name)}</h2><small>${itemEffect?'Item effect':'Active effect'}</small></header><div class="bg3-tooltip-facts"><span data-effect-duration="${esc(effect.uuid)}">${esc(duration(effect))}</span>${effect.disabled?'<span>Disabled</span>':''}${source?`<span>Source: ${esc(source)}</span>`:''}</div><div class="bg3-tooltip-description">${context.strings.intro||'<p>No description provided.</p>'}${context.strings.content||''}</div>${context.buttons.length?`<div class="bg3-effect-buttons">${context.buttons.map((b,i)=>`<button data-effect-button="${i}">${esc(b.label)}</button>`).join('')}</div>`:''}${allowed?`<footer>Double-click to ${effect.disabled?'enable':'disable'} · Ctrl-double-click to configure<small>Right-click to cancel${game.user.isGM?' · Shift-right-click to cancel immediately':''}</small></footer>`:''}`;
  }
  updateDurations(){
    for(const [i,{effect}] of this.entries.entries()){
      effect.updateDuration?.();
      this.element?.querySelector(`[data-effect="${i}"] .bg3-effect-clock`)?.classList.toggle('expired',!!effect.duration?.expired);
      const badge=this.element?.querySelector(`[data-effect="${i}"] .bg3-effect-clock`);if(badge){const infinite=effect.duration?.remaining===Infinity;badge.classList.toggle('fa-infinity',infinite);badge.classList.toggle('fa-clock',!infinite);}
      const label=this.bar.tooltip?.querySelector('[data-effect-duration]');if(label?.dataset.effectDuration===effect.uuid)label.textContent=duration(effect);
    }
  }
  layout(){
    if(!this.element?.isConnected)return;
    const root=this.root,main=root.querySelector('.bg3-main'),frame=root.querySelector('.bg3-action-frame'),resources=root.querySelector('.bg3-resources');
    root.style.setProperty('--effects-expand','0px');
    const scale=main.getBoundingClientRect().width/main.offsetWidth;
    const resourceRight=Math.max(resources.getBoundingClientRect().right,resources.querySelector('.bg3-class-resources')?.getBoundingClientRect().right??0);
    const frameRight=frame.getBoundingClientRect().right;
    const availableRight=(frameRight-resourceRight)/scale-24;
    // Insets cannot consume the minimum one-icon lane or compromise resource spacing.
    const inset=Math.min(this.prefs.rightOffset,Math.max(0,availableRight-this.prefs.iconSize));
    const available=Math.max(this.prefs.iconSize,availableRight-inset);
    const grid=effectGrid(this.entries.length,available,this.prefs.iconSize);
    this.element.style.right=`${(main.getBoundingClientRect().right-frameRight)/scale+inset}px`;this.element.style.setProperty('--effect-columns',grid.columns);
    this.element.dataset.rows=grid.rows;root.style.setProperty('--effects-expand',`${grid.expansion}px`);
    this.bar.paintResources();if(!this.bar.resizing)this.bar.applyScale();
    this.updateDurations();
  }
}
