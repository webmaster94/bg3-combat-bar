import {ID} from './model.js';

export function representedActor(ctx){
  return ctx?.token?.baseActor??globalThis.game?.actors?.get?.(ctx?.token?.actorId)??null;
}
export function canOverrideBar(ctx){return !!ctx?.token&&!ctx.token.actorLink&&!!representedActor(ctx);}
export function hasCustomBar(ctx){return canOverrideBar(ctx)&&ctx.token.getFlag(ID,'customBar')===true;}
export function usesSharedBar(ctx){return canOverrideBar(ctx)&&!hasCustomBar(ctx);}
export function layoutDocument(ctx){return usesSharedBar(ctx)?representedActor(ctx):ctx?.document;}

// Embedded IDs inherited from the represented Actor identify the corresponding
// item on each synthetic Actor. Never execute an item on the template Actor.
export function droppedItem(ctx,item){
  if(item?.actor?.uuid===ctx.actor.uuid)return item;
  if(item?.actor?.uuid===representedActor(ctx)?.uuid)return ctx.actor.items.get(item.id);
  return null;
}
