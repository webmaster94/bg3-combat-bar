// These Token fields affect canvas placement, not the bar's displayed data.
// Check every changed root so motion mixed with flags or actor deltas still refreshes.
const MOTION_FIELDS=new Set(['_id','x','y','elevation','rotation','_movementHistory','_regions']);
export function movementOnly(changes={}){
  const keys=Object.keys(changes);
  return keys.length>0&&keys.every(key=>MOTION_FIELDS.has(key.split('.')[0]));
}
export function movesToken(changes={}){
  return Object.keys(changes).some(key=>['x','y','elevation'].includes(key.split('.')[0]));
}
export function affectsActor(document,ctx){
  // Effects may belong to an Item, including an item within a synthetic Actor.
  let actor=document;
  while(actor&&actor.documentName!=='Actor')actor=actor.parent;
  if(!actor||!ctx?.actor)return false;
  return actor.uuid===ctx.actor.uuid||actor.uuid===ctx.token?.baseActor?.uuid;
}
