// Read the system's prepared uses, including evaluated scale formulas. Never create a second pool.
export function limitedUses(uses) {
  const max=Number(uses?.max);
  if(!Number.isFinite(max)||max<=0)return null;
  const value=Number(uses.value ?? max-Number(uses.spent||0));
  return {max:Math.floor(max),value:Math.max(0,Math.min(max,Number.isFinite(value)?value:0))};
}
const slug=value=>String(value??'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function resourceKind(item) {
  if(item.type!=='feat')return null;
  const ids=[slug(item.system?.identifier),slug(item.name)];
  if(ids.some(id=>['font-of-magic','sorcery-points','metamagic-adept'].includes(id)))return 'sorcery';
  if(ids.some(id=>['monks-focus','focus-points','ki','ki-points'].includes(id)))return 'monk';
  return null;
}
export function classResources(actor) {
  const pools=new Map();
  for(const item of actor.items??[]){
    const kind=resourceKind(item);if(!kind||pools.has(kind))continue;
    let uses=limitedUses(item.system.uses),activityId;
    if(!uses)for(const activity of item.system.activities??[]){uses=limitedUses(activity.uses);if(uses){activityId=activity.id;break;}}
    if(!uses)continue;
    const ki=/\bki\b/i.test(item.name)||slug(item.system.identifier)==='ki';
    pools.set(kind,{kind,name:kind==='sorcery'?'Sorcery points':ki?'Ki points':'Focus points',itemId:item.id,activityId,...uses});
  }
  // Older sheets sometimes store these pools in a labeled actor resource instead of a feature.
  for(const [key,resource] of Object.entries(actor.system?.resources??{})){
    const name=slug(resource.label),kind=name==='sorcery-points'?'sorcery':['ki','ki-points','focus-points'].includes(name)?'monk':null;
    const uses=limitedUses(resource);
    if(kind&&uses&&!pools.has(kind))pools.set(kind,{kind,name:kind==='sorcery'?'Sorcery points':name.startsWith('ki')?'Ki points':'Focus points',resourceKey:key,...uses});
  }
  return [...pools.values()];
}
