import {ID, normalizeLayout, turnKey, freshEconomy, spendEconomy} from "./model.js";
import {sectionDefinitions,normalizeSections} from './sections.js';
import {layoutDocument,usesSharedBar,canOverrideBar,representedActor} from './layout-storage.js';
const queues = new Map();
const VIEW_FIELDS=['locked','page','weaponTab','weaponSet','activeLoadout'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sameCounter=(a,b)=>!!a&&!!b&&!a.itemId&&!b.itemId&&a.name===b.name&&a.max===b.max&&a.reset===b.reset;
const matchCounter=(resources,r,index)=>{const byId=r.id&&resources.find(c=>c.id===r.id&&sameCounter(c,r));if(byId)return byId;if(sameCounter(resources[index],r))return resources[index];const matches=resources.filter(c=>sameCounter(c,r));return matches.length===1?matches[0]:null;};
const counterIds=data=>{data.resources.forEach((r,i)=>{if(!r.itemId)r.id??=`counter-${i}`;});return data;};
const readLayout=ctx=>counterIds(normalizeLayout(layoutDocument(ctx).getFlag(ID,'layout'),sectionDefinitions(ctx).map(s=>s.id)));
export function storage(actor, token) { return token && !token.actorLink ? token : actor; }
export function context(token) { return token?.actor ? {actor:token.actor, token, document:storage(token.actor,token)} : null; }
export function layout(ctx) {
  const data=readLayout(ctx);if(!usesSharedBar(ctx))return data;
  const saved=ctx.token.getFlag(ID,'barState'),state=saved?.source===layoutDocument(ctx).uuid?saved:null;
  for(const key of VIEW_FIELDS)if(Object.hasOwn(state?.view??{},key))data[key]=structuredClone(state.view[key]);
  data.page=Math.max(0,Math.min(data.pages.length-1,Math.trunc(Number(data.page))||0));
  for(const r of data.resources)if(!r.itemId){const value=Object.hasOwn(state?.resources??{},r.id)?state.resources[r.id]:r.value??r.max;r.value=Math.max(0,Math.min(Number(r.max),Number(value)));}
  return data;
}
export async function editLayout(ctx, change) {
  const owner=layoutDocument(ctx);
  return serial(owner.uuid, async () => {
    if(layoutDocument(ctx).uuid!==owner.uuid)throw Error('The bar source changed. Try again.');
    const shared=readLayout(ctx),data=layout(ctx),previous=structuredClone(data.resources);await change(data);
    if(layoutDocument(ctx).uuid!==owner.uuid)throw Error('The bar source changed. Try again.');
    data.resources.forEach((r,i)=>{if(!r.itemId)r.id??=previous[i]?.id??`counter-${globalThis.foundry?.utils?.randomID?.()??Math.random().toString(36).slice(2)}`;});
    if(!usesSharedBar(ctx)){await owner.setFlag(ID,'layout',data);return data;}
    const state={source:owner.uuid,view:Object.fromEntries(VIEW_FIELDS.map(k=>[k,structuredClone(data[k])])),resources:Object.fromEntries(data.resources.filter(r=>!r.itemId).map(r=>[r.id,r.value??r.max]))};
    const template=structuredClone(data);
    for(const key of VIEW_FIELDS)template[key]=structuredClone(shared[key]);
    for(const r of template.resources)if(!r.itemId){const original=shared.resources.find(old=>old.id===r.id);r.value=Math.min(Number(r.max),Number(original?.value??r.value??r.max));}
    if(!same(shared,template))await owner.setFlag(ID,'layout',template);
    if(!same(ctx.token.getFlag(ID,'barState'),state))await ctx.token.setFlag(ID,'barState',state);
    return data;
  });
}

export async function setCustomBar(ctx,enabled){
  if(!canOverrideBar(ctx)||!ctx.actor.isOwner)return;
  const owner=layoutDocument(ctx);
  return serial(owner.uuid,async()=>{
    if(layout(ctx).locked)throw Error('Enter Build mode to change the bar source.');
    const current=layout(ctx),updates={[`flags.${ID}.customBar`]:enabled};
    if(enabled){
      const saved=ctx.token.getFlag(ID,'layout'),copy=saved?normalizeLayout(saved):layout(ctx);copy.locked=false;
      for(const [index,r] of copy.resources.entries())if(!r.itemId){const match=matchCounter(current.resources,r,index);if(match)r.value=match.value;}
      updates[`flags.${ID}.layout`]=copy;
      if(!ctx.token.getFlag(ID,'characterSections'))updates[`flags.${ID}.characterSections`]=structuredClone(owner.getFlag(ID,'characterSections')??{});
    }else{
      const base=representedActor(ctx),state=ctx.token.getFlag(ID,'barState');
      const resources={...(state?.source===base.uuid?state.resources:{})};
      for(const [index,r] of counterIds(normalizeLayout(base.getFlag(ID,'layout'))).resources.entries())if(!r.itemId){const match=matchCounter(current.resources,r,index);if(match)resources[r.id]=match.value;}
      updates[`flags.${ID}.barState`]={...(state?.source===base.uuid?structuredClone(state):{}),source:base.uuid,view:{...(state?.source===base.uuid?state.view:{}),locked:false},resources};
    }
    await ctx.token.update(updates);
  });
}

export async function initializeSharedBars(){
  if(!game.user?.isGM||game.users?.activeGM?.id!==game.user.id)return;
  // Seed an unused template once from a legacy token bar, keeping each legacy
  // layout intact as that token's saved custom bar.
  for(const scene of game.scenes??[])for(const token of scene.tokens??[]){
    if(token.actorLink||token.getFlag(ID,'customBar')!==undefined)continue;
    const saved=token.getFlag(ID,'layout');if(!saved)continue;
    const base=token.baseActor??game.actors?.get(token.actorId);if(!base)continue;
    if(!base.getFlag(ID,'layout')){
      const updates={[`flags.${ID}.layout`]:structuredClone(saved)};
      const existing=base.getFlag(ID,'characterSections'),legacy=token.getFlag(ID,'characterSections')??{};
      updates[`flags.${ID}.characterSections`]=existing?{...structuredClone(existing),custom:normalizeSections([...(existing.custom??[]),...(legacy.custom??[])])}:structuredClone(legacy);
      await base.update(updates);
    }
    const template=counterIds(normalizeLayout(base.getFlag(ID,'layout'))),old=normalizeLayout(saved);
    const resources=Object.fromEntries(template.resources.filter(r=>!r.itemId).map(r=>{
      const match=matchCounter(old.resources,r,template.resources.indexOf(r));
      return [r.id,match?.value??r.value??r.max];
    }));
    const state=token.getFlag(ID,'barState');
    await token.update({[`flags.${ID}.customBar`]:false,[`flags.${ID}.barState`]:state?.source===base.uuid?state:{source:base.uuid,view:Object.fromEntries(VIEW_FIELDS.map(k=>[k,structuredClone(old[k])])),resources}});
  }
}
export async function serial(key, action) {
  const previous = queues.get(key) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(action);
  queues.set(key,pending);
  try { return await pending; } finally { if (queues.get(key) === pending) queues.delete(key); }
}
export function economy(ctx) {
  const combat=game.combat;
  const index=combat?.turns.findIndex(c=>c.tokenId===ctx.token?.id&&c.sceneId===ctx.token?.parent?.id)??-1;
  const key=combat?.started&&index>=0?`${combat.id}:${combat.round-(combat.turn<index?1:0)}:${combat.turns[index].id}`:turnKey(combat);
  const saved = ctx.document.getFlag(ID,"economy");
  const state=saved?.key === key ? {...freshEconomy(key),...structuredClone(saved)} : freshEconomy(key);
  if(midiReactions(ctx.actor)){
    const actions=ctx.actor.getFlag('midi-qol','actions');
    state.reaction=Math.max(0,Number(actions?.reactionsMax??1)-Number(actions?.reactionsUsed??0));
  }
  return state;
}
export function midiReactions(actor) {
  const midi=globalThis.MidiQOL;
  return !!game.modules?.get('midi-qol')?.active && typeof midi?.setReactionUsed==='function' && typeof midi?.removeReactionUsed==='function' && ['all','displayOnly',actor.type].includes(midi.configSettings?.().enforceReactions);
}
export async function setEconomy(ctx,cost,restore=false) {
  return serial(`${ctx.document.uuid}:economy`,async()=>{
    if(!restore&&economy(ctx)[cost]<=0)return;
    if(cost==='reaction'&&midiReactions(ctx.actor))return restore?MidiQOL.removeReactionUsed(ctx.actor,true):MidiQOL.setReactionUsed(ctx.actor);
    const state=economy(ctx);state[cost]=restore?1:0;
    await ctx.document.setFlag(ID,'economy',state);
  });
}
export async function changeSpellSlots(ctx,key,restore=false) {
  return serial(`${ctx.document.uuid}:spellSlots`,async()=>{
    if(!/^(spell[1-9]|pact)$/.test(key))return;
    const slots=ctx.actor.system.spells?.[key],max=Number(slots?.max),current=Number(slots?.value);
    if(!Number.isFinite(max)||max<=0||!Number.isFinite(current))return;
    const value=Math.max(0,Math.min(max,current+(restore?1:-1)));
    if(value!==current)await ctx.actor.update({[`system.spells.${key}.value`]:value});
  });
}
export function actionCost(actor, generic) {
  return foundry.utils.getProperty(actor.flags, `${ID}.actionCosts.${generic}`) ?? (generic === "hide" && actor.getFlag(ID,"hideAsBonusAction") ? "bonus" : ["grapple","shove"].includes(generic) ? "attack" : "action");
}
export function attacksPerAction(actor) {
  const explicit = Number(actor.getFlag(ID,"attacksPerAction"));
  if (explicit > 0) return Math.min(10,Math.trunc(explicit));
  const fighter = actor.classes?.fighter?.system?.levels ?? 0;
  if (fighter >= 20) return 4;
  if (fighter >= 11) return 3;
  if (actor.items.some(i => i.system?.identifier === "extra-attack" || /^extra attack\b/i.test(i.name))) return 2;
  return 1;
}
export async function consume(ctx, cost) {
  if (!game.combat?.started) return;
  // Midi marks reaction use itself, including reactions prompted outside a sheet activity.
  if(cost==='reaction'&&midiReactions(ctx.actor))return;
  return serial(`${ctx.document.uuid}:economy`, async () => {
    const next = spendEconomy(economy(ctx),cost,attacksPerAction(ctx.actor));
    if (!next && game.settings.get(ID,'disableActionEnforcement')) return;
    if (!next) throw new Error(`No ${cost === "attack" ? "attacks or actions" : `${cost} actions`} remaining. Right-click its resource to restore a spent action.`);
    await ctx.document.setFlag(ID,"economy",next);
  });
}
export function canSpend(ctx,cost) { return !game.combat?.started || game.settings.get(ID,'disableActionEnforcement') || !!spendEconomy(economy(ctx),cost,attacksPerAction(ctx.actor)); }
export function isTurn(ctx) {
  const c = game.combat?.combatant;
  return !!game.combat?.started && !!c && (c.tokenId === ctx.token?.id && c.sceneId === ctx.token?.parent?.id);
}
export async function equipLoadout(ctx,data,type,index) {
  const selected = new Set(data.weapons[type][index].filter(Boolean));
  const managed = new Set(Object.values(data.weapons).flat(2).filter(Boolean));
  const updates = [...managed].map(id => ctx.actor.items.get(id)).filter(Boolean)
    .filter(item => item.system.equipped !== selected.has(item.id))
    .map(item => ({_id:item.id,"system.equipped":selected.has(item.id)}));
  if (updates.length) await ctx.actor.updateEmbeddedDocuments("Item",updates);
  data.activeLoadout = {type,index}; data.weaponTab=type; data.weaponSet[type]=index;
}
