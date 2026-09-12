import {ID, normalizeLayout, turnKey, freshEconomy, spendEconomy} from "./model.js";
const queues = new Map();
export function storage(actor, token) { return token && !token.actorLink ? token : actor; }
export function context(token) { return token?.actor ? {actor:token.actor, token, document:storage(token.actor,token)} : null; }
export function layout(ctx) { return normalizeLayout(ctx.document.getFlag(ID,"layout")); }
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
  return saved?.key === key ? structuredClone(saved) : freshEconomy(key);
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
