import {ID,escapeHTML as esc} from './model.js';
import {layout} from './state.js';
import {choose} from './dialogs.js';

const localize=value=>globalThis.game?.i18n?.localize?.(value)??value;
const range=value=>Number(value)>0?Number(value):0;
const detectionEntries=token=>Array.isArray(token.detectionModes)?token.detectionModes.map(m=>[m.id,m]):Object.entries(token.detectionModes??{});
export const tokenName=ctx=>ctx.token?.name??ctx.actor?.name??'';

export async function renameFromBar(ctx,value){
  if(layout(ctx).locked||!ctx.token||!ctx.actor.isOwner)return;
  const name=String(value).trim().slice(0,128);if(!name)throw Error('Enter a name.');
  if(name===tokenName(ctx))return;
  let target='token';
  if(ctx.token.actorLink){
    const result=await choose('Rename Linked Token',`<p>Use <strong>${esc(name)}</strong> as this token's name or the linked actor's name?</p><p>Token Name changes only this scene token. Actor Name changes the character sheet name.</p>`,[{value:'token',label:'Token Name'},{value:'actor',label:'Actor Name'},{value:'cancel',label:'Cancel'}]);
    if(!['token','actor'].includes(result?.button))return;target=result.button;
  }
  await (target==='actor'?ctx.actor:ctx.token).update({name});
  if(target==='actor')globalThis.ui?.notifications?.info?.(`Actor renamed to ${name}.`);
}

export function movementChoices(ctx){
  if(!ctx?.token||!('movementAction' in ctx.token))return [];
  const movement=ctx.actor?.system?.attributes?.movement??{},speeds=movement.speeds??movement;
  return Object.entries(globalThis.CONFIG?.Token?.movement?.actions??{}).filter(([id,config])=>{
    if(!range(speeds[id])||globalThis.CONFIG?.DND5E?.movementTypes?.[id]?.hidden)return false;
    return typeof config.canSelect==='function'?config.canSelect(ctx.token):config.canSelect!==false;
  }).map(([id,config])=>({id,label:localize(config.label),icon:config.icon??'fa-solid fa-person-walking',speed:range(speeds[id]),active:ctx.token.movementAction===id}));
}
export async function setMovement(ctx,id){
  if(!ctx.actor.isOwner||!movementChoices(ctx).some(choice=>choice.id===id))throw Error('That movement type is not available.');
  await ctx.token.update({movementAction:id});
}

export function sightChoices(ctx){
  const token=ctx?.token;if(!token)return {vision:[],detection:[]};
  const profile=token.getFlag?.(ID,'sightProfile'),base=profile?.base??token._source?.sight??token.sight??{};
  const senses=ctx.actor?.system?.attributes?.senses??{},ranges=senses.ranges??senses;
  const modes=globalThis.CONFIG?.Canvas?.visionModes??{},detectionConfigs=globalThis.CONFIG?.Canvas?.detectionModes??{};
  const vision=[{id:'basic',label:'Normal Sight',range:0}];
  const dark=range(ranges.darkvision)||(['darkvision','monochromatic'].includes(base.visionMode)?range(base.range):0);
  if(dark&&modes.darkvision)vision.push({id:'darkvision',label:'Darkvision',range:dark});
  if(base.visionMode&&modes[base.visionMode]&&!vision.some(c=>c.id===base.visionMode))vision.push({id:base.visionMode,label:localize(modes[base.visionMode].label),range:base.range});
  const configured=new Map(detectionEntries(token));
  // Read both D&D 5's fixed senses and D&D 6's configurable sense metadata.
  for(const [sense,fallback] of Object.entries({blindsight:'blindsight',tremorsense:'feelTremor',truesight:'seeAll'})){
    const id=globalThis.CONFIG?.DND5E?.senses?.[sense]?.detectionMode??fallback,r=range(ranges[sense]);
    if(r&&detectionConfigs[id])configured.set(id,{...configured.get(id),range:r,enabled:profile?.disabled?.includes(id)?false:configured.get(id)?.enabled!==false});
  }
  const detection=[...configured].filter(([id,m])=>!['basicSight','lightPerception'].includes(id)&&detectionConfigs[id]&&range(m.range)).map(([id,m])=>({id,label:localize(detectionConfigs[id].label??id),range:m.range,active:m.enabled!==false}));
  const active=profile?.choice??token.sight?.visionMode??'basic';
  return {vision:vision.map(c=>({...c,active:c.id===active})),detection};
}
export async function setSight(ctx,id,{detection=false}={}){
  if(!ctx.actor.isOwner)throw Error('You do not own this token.');
  const token=ctx.token,choices=sightChoices(ctx),choice=(detection?choices.detection:choices.vision).find(c=>c.id===id);
  if(!choice)throw Error('That sight type is not available.');
  const saved=token.getFlag?.(ID,'sightProfile');
  const profile=structuredClone(saved??{base:token._source?.sight??token.sight,baseDetection:token._source?.detectionModes??token.detectionModes??{},disabled:[]});
  const updates={[`flags.${ID}.sightProfile`]:profile};
  if(detection){
    profile.disabled=choice.active?[...new Set([...(profile.disabled??[]),id])]:(profile.disabled??[]).filter(k=>k!==id);
    if(Array.isArray(token.detectionModes))updates.detectionModes=[...new Map([...detectionEntries(token),[id,{id,enabled:!choice.active,range:choice.range}]]).values()].map(m=>({...m}));
    else updates[`detectionModes.${id}`]={enabled:!choice.active,range:choice.range};
  }else{
    profile.choice=id;
    Object.assign(updates,Object.fromEntries(Object.entries(globalThis.CONFIG?.Canvas?.visionModes?.[id]?.vision?.defaults??{}).filter(([,v])=>v!==undefined).map(([k,v])=>[`sight.${k}`,v])));
    updates['sight.visionMode']=id;updates['sight.range']=choice.range;
    if(!Array.isArray(token.detectionModes))updates['detectionModes.basicSight']={enabled:true,range:choice.range};
  }
  await token.update(updates,{bg3SightSelection:true});
}
export async function resetSight(ctx){
  if(!ctx.actor.isOwner)return;
  const profile=ctx.token.getFlag?.(ID,'sightProfile');if(!profile)return;
  const updates={[`flags.${ID}.-=sightProfile`]:null,sight:profile.base};
  if(profile.baseDetection){
    if(Array.isArray(profile.baseDetection))updates.detectionModes=profile.baseDetection;
    else{
      updates.detectionModes={...profile.baseDetection};
      for(const id of Object.keys(ctx.token._source?.detectionModes??{}))if(!(id in profile.baseDetection))updates.detectionModes[`-=${id}`]=null;
    }
  }
  await ctx.token.update(updates,{bg3SightSelection:true});
}

// D&D 6 prepares vision from senses after reading Token fields. Reapply this token's
// chosen viewing mode at that same boundary, before core seeds basic sight.
export function applySightPreference(token){
  const profile=token.getFlag?.(ID,'sightProfile');if(!profile)return;
  const choices=sightChoices({token,actor:token.actor});
  if(profile.choice){
    const choice=choices.vision.find(c=>c.id===profile.choice)??choices.vision[0];
    Object.assign(token.sight,CONFIG.Canvas.visionModes[choice.id]?.vision?.defaults??{},{visionMode:choice.id,range:choice.range});
    if(token.detectionModes.basicSight)Object.assign(token.detectionModes.basicSight,{range:choice.range});
  }
  for(const id of profile.disabled??[])if(token.detectionModes[id])token.detectionModes[id].enabled=false;
}
export function registerSightPreference(){
  const proto=CONFIG.Token.documentClass?.prototype,original=proto?._applySenseVision;
  if(typeof original==='function'){
    if(globalThis.libWrapper?.register)libWrapper.register(ID,'CONFIG.Token.documentClass.prototype._applySenseVision',function(wrapped,...args){const result=wrapped(...args);applySightPreference(this);return result;},'WRAPPER');
    else proto._applySenseVision=function(...args){const result=original.apply(this,args);applySightPreference(this);return result;};
  }
  Hooks.on('preUpdateToken',(token,changes,options={})=>{
    if(options.bg3SightSelection||!token.getFlag?.(ID,'sightProfile'))return;
    if(Object.keys(changes).some(k=>k==='sight'||k.startsWith('sight.')||k==='detectionModes'||k.startsWith('detectionModes.')))changes[`flags.${ID}.-=sightProfile`]=null;
  });
}

export class TokenControls{
  constructor(bar){this.bar=bar;}
  close(){this.element?.remove();this.element=null;this.abort?.abort();}
  buttons(ctx){
    const movement=movementChoices(ctx),sight=sightChoices(ctx),hasSight=sight.vision.length+sight.detection.length>1;
    if(movement.length<2&&!hasSight)return '';
    return `<div class="bg3-token-controls">${movement.length>1?'<button data-token-mode="movement" title="Movement Type" aria-label="Movement Type"><i class="fa-solid fa-person-walking" inert></i></button>':''}${hasSight?'<button data-token-mode="sight" title="Sight Type" aria-label="Sight Type"><i class="fa-solid fa-eye" inert></i></button>':''}</div>`;
  }
  open(ctx,kind,anchor){
    this.close();this.bar.hideTooltip();const panel=this.element=document.createElement('aside');panel.className='bg3-token-menu';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',kind==='movement'?'Movement Type':'Sight Type');
    const entry=(c,type)=>`<button type="button" data-mode="${esc(c.id)}" data-kind="${type}" aria-pressed="${c.active}"><span>${esc(c.label)}</span><small>${c.active?'✓ ':''}${c.id==='basic'?'Lit Areas':esc(`${c.speed??c.range??''} ${ctx.token.parent?.grid?.units??'ft'}`)}</small></button>`;
    const senses=sightChoices(ctx);
    panel.innerHTML=`<header>${kind==='movement'?'Movement Type':'Sight Type'}<button data-close aria-label="Close">×</button></header>${kind==='movement'?movementChoices(ctx).map(c=>entry(c,'movement')).join(''):senses.vision.map(c=>entry(c,'vision')).join('')+(senses.detection.length?'<small>Additional Senses</small>'+senses.detection.map(c=>entry(c,'detection')).join(''):'')+'<button data-reset>Automatic Sight</button>'}`;
    document.body.append(panel);const r=anchor.getBoundingClientRect(),p=panel.getBoundingClientRect();panel.style.left=`${Math.max(8,Math.min(innerWidth-p.width-8,r.left))}px`;panel.style.top=`${Math.max(8,r.top-p.height-8)}px`;
    panel.querySelector('[data-close]').onclick=()=>this.close();
    const run=fn=>async()=>{this.close();try{await fn();this.bar.schedule();}catch(error){ui.notifications.warn(error.message);}};
    panel.querySelectorAll('[data-mode]').forEach(b=>b.onclick=run(()=>b.dataset.kind==='movement'?setMovement(ctx,b.dataset.mode):setSight(ctx,b.dataset.mode,{detection:b.dataset.kind==='detection'})));
    panel.querySelector('[data-reset]')?.addEventListener('click',run(()=>resetSight(ctx)));
    this.abort=new AbortController();document.addEventListener('pointerdown',e=>{if(!panel.contains(e.target)&&!anchor.contains(e.target))this.close();},{signal:this.abort.signal});
    panel.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();this.close();anchor.focus();}else if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const buttons=[...panel.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}};
    (panel.querySelector('[aria-pressed="true"]')??panel.querySelector('[data-mode]'))?.focus();
  }
}
