import {ID, normalizeLayout, turnKey, freshEconomy, spendEconomy} from "./model.js";
import {sectionDefinitions} from './sections.js';
const queues = new Map();
export function storage(actor, token) { return token && !token.actorLink ? token : actor; }
export function context(token) { return token?.actor ? {actor:token.actor, token, document:storage(token.actor,token)} : null; }
export function layout(ctx) { return normalizeLayout(ctx.document.getFlag(ID,"layout"),sectionDefinitions(ctx).map(s=>s.id)); }
export async function editLayout(ctx, change) {
  return serial(ctx.document.uuid, async () => {
    const data = layout(ctx); await change(data); await ctx.document.setFlag(ID,"layout",data); return data;
  });
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
    if (!next) throw new Error(`No ${cost === "attack" ? "attacks or actions" : `${cost} actions`} remaining. Right-click its resource to restore a spent action.`);
    await ctx.document.setFlag(ID,"economy",next);
  });
}
export function canSpend(ctx,cost) { return !game.combat?.started || !!spendEconomy(economy(ctx),cost,attacksPerAction(ctx.actor)); }
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
