// Shared presentation state. Native activity.use remains responsible for consumption.
export const itemActivities=item=>Array.from(item?.system?.activities??[]).filter(a=>!a.isRider);
export function limitedUses(uses){
  const max=Number(uses?.max);if(!(max>0))return null;
  return {max,value:Number(uses.value??Math.max(0,max-Number(uses.spent??0)))};
}
const badge=uses=>{const u=limitedUses(uses);return u?`${u.value}/${u.max}`:'';};
const method=item=>item.system.method??item.system.preparation?.mode;
const linkedActivity=(item,a)=>a?.consumption?.spellSlot===false?null:item?.system?.linkedActivity;
export function needsSpellSlot(item,activity){
  if(item?.type!=='spell'||!(item.system.level>0)||activity?.consumption?.spellSlot===false)return false;
  if(linkedActivity(item,activity))return false;
  if(typeof activity?.requiresSpellSlot==='boolean')return activity.requiresSpellSlot;
  return !['atwill','innate','ritual'].includes(method(item));
}
export function hasSpellSlot(item,actor=item.actor){
  const config=globalThis.CONFIG?.DND5E?.spellcasting??{},casting=config[method(item)];
  return Object.entries(actor?.system?.spells??{}).some(([key,s])=>{
    const type=s.type??(key==='pact'?'pact':'spell'),level=Number(s.level??key.replace('spell',''));
    return s.value>0&&level>=item.system.level&&!(casting?.exclusive?.spells&&method(item)!==type)&&!(config[type]?.exclusive?.slots&&method(item)!==type);
  });
}
function restricted(item,a){return needsSpellSlot(item,a)||linkedActivity(item,a)||Array.from(a?.consumption?.targets??[]).some(t=>String(t.value??'1')!=='0')||limitedUses(a?.uses);}
export function useDisplay(item,activity=null){
  if(!item)return '';
  if(activity)return badge(activity.uses)||(!restricted(item,activity)?'∞':'');
  const own=badge(item.system.uses);if(own)return own;
  const activities=itemActivities(item);
  if(activities.length===1&&badge(activities[0].uses))return badge(activities[0].uses);
  if(activities.some(a=>restricted(item,a))||needsSpellSlot(item,activities[0]))return '';
  if(item.type==='consumable')return '';
  return '∞';
}
function preparationWarning(item){
  if(item.type!=='spell'||!item.system.level)return false;
  const m=method(item),prepares=globalThis.CONFIG?.DND5E?.spellcasting?.[m]?.prepares??['spell','pact','prepared'].includes(m);
  return prepares&&Number(item.system.prepared??item.system.preparation?.prepared??1)===0;
}
function activityWarnings(item,a,actor,seen=new Set()){
  if(seen.has(a))return [];seen.add(a);
  const reasons=[];
  const linked=linkedActivity(item,a);if(linked?.item)reasons.push(...activityWarnings(linked.item,linked,actor,seen));
  if(a?.visibility?.requireAttunement&&!item.system.attuned)reasons.push('Not attuned');
  if(a?.visibility?.requireIdentification&&item.system.identified===false)reasons.push('Not identified');
  if(a?.visibility?.requireMagic&&item.system.magicAvailable===false&&!reasons.length)reasons.push('Magic is unavailable');
  if(a?.canUse===false&&!reasons.length)reasons.push('Activity requirements not met');
  if(limitedUses(a?.uses)?.value===0)reasons.push('No activity uses remaining');
  for(const t of a?.consumption?.targets??[]){
    // Formula costs are resolved by the system at use time, never guessed here.
    const cost=Number(t.value??1);if(!Number.isFinite(cost)||cost<=0)continue;
    if(t.type==='itemUses'){
      const source=t.target?actor?.items?.get(t.target):item,u=limitedUses(source?.system?.uses);
      if(!source)reasons.push('Required resource item is missing');
      else if(u&&u.value<cost)reasons.push(source===item?'No uses remaining':`Not enough ${source.name} uses`);
    }else if(t.type==='activityUses'){
      const u=limitedUses(a.uses);if(u&&u.value<cost&&!reasons.includes('No activity uses remaining'))reasons.push('Not enough activity uses');
    }else if(t.type==='material'){
      const source=t.target?actor?.items?.get(t.target):item;if(!source||Number(source.system.quantity)<cost)reasons.push('Not enough item quantity');
    }else if(t.type==='attribute'){
      const value=t.target?.split('.').reduce((v,k)=>v?.[k],actor?.system);if(value!==undefined&&Number(value)<cost)reasons.push('Not enough resource remaining');
    }else if(t.type==='spellSlots'){
      const slots=actor?.system?.spells??{},pool=slots[t.target]??slots[`spell${t.target}`];
      if(pool&&pool.value<cost)reasons.push('Not enough spell slots');
    }
  }
  if(needsSpellSlot(item,a)&&!hasSpellSlot(item,actor))reasons.push('No spell slots of this level or higher remaining');
  return [...new Set(reasons)];
}
export function itemState(item,activity=null,actor=item?.actor){
  if(!item)return {badge:'',quantity:'',unavailable:false,reasons:[]};
  const reasons=[];
  if(preparationWarning(item))reasons.push('Not prepared');
  if(item.type==='consumable'&&Number(item.system.quantity)===0)reasons.push('No quantity remaining');
  const activities=activity?[activity]:itemActivities(item),states=activities.map(a=>activityWarnings(item,a,actor));
  if(states.length&&states.every(r=>r.length))reasons.push(...states.flat());
  if(!activities.length){
    if(limitedUses(item.system.uses)?.value===0)reasons.push('No uses remaining');
    if(['required',1].includes(item.system.attunement)&&!item.system.attuned)reasons.push('Not attuned');
    if(needsSpellSlot(item)&&!hasSpellSlot(item,actor))reasons.push('No spell slots of this level or higher remaining');
  }
  return {badge:useDisplay(item,activity),quantity:Number(item.system.quantity)>1?String(item.system.quantity):'',unavailable:!!reasons.length,reasons:[...new Set(reasons)]};
}
