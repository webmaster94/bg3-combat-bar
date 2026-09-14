// Manual entry points only. Never remove activities from the Item itself:
// Midi and CPR still need its riders to execute the complete workflow.
export function displayActivities(item){
  let activities=Array.from(item?.system?.activities??[]).filter(a=>!a.isRider);
  if(globalThis.game?.modules?.get('midi-qol')?.active){
    const riders=new Set(item?.flags?.dnd5e?.riders?.activity??[]);
    const cpr=item?.flags?.['chris-premades']??{};
    const hidden=new Set(cpr.hiddenActivities??[]);
    for(const identifier of hidden){const id=cpr.activityIdentifiers?.[identifier];if(id)riders.add(id);}
    activities=activities.filter(a=>!riders.has(a.id)&&!hidden.has(a.id)&&!hidden.has(a.identifier)&&!a.midiProperties?.automationOnly&&!a.inProgress);
    // Midi directly runs a sole attack together with its resolved other activity.
    const attacks=activities.filter(a=>a.type==='attack');
    if(attacks.length===1&&activities.length===2){
      const attack=attacks[0],other=attack.otherActivity;
      if(other&&activities.includes(other))activities=[attack];
    }
  }
  return activities.sort((a,b)=>(a.sort??0)-(b.sort??0));
}
export function usableActivities(item){return displayActivities(item).filter(a=>a.canUse);}
