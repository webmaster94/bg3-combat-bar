export const EFFECT_SETTINGS={
  iconSize:{name:'Effect icon size',hint:'Size of active effect icons.',scope:'client',type:Number,default:50,range:{min:10,max:100,step:1}},
  fontSize:{name:'Effect tooltip font size',hint:'Text size in effect tooltips.',scope:'client',type:Number,default:16,range:{min:4,max:50,step:1}},
  topOffset:{name:'Effect panel vertical gap',hint:'Space above the bar, in pixels.',scope:'client',type:Number,default:16,range:{min:0,max:200,step:1}},
  rightOffset:{name:'Effect panel right inset',hint:'Space from the right edge of the bar, in pixels.',scope:'client',type:Number,default:0,range:{min:0,max:500,step:1}},
  hideDisabled:{name:'Hide disabled effects',hint:'Hide disabled effects unless their icon is set to Always Show.',scope:'world',type:Boolean,default:false},
  hidePassive:{name:'Hide passive effects',hint:'Hide effects without a temporary duration unless their icon is set to Always Show.',scope:'world',type:Boolean,default:true},
  playerClicks:{name:'Allow player effect interaction',hint:'Let owners toggle, configure, and cancel effects from the bar.',scope:'world',type:Boolean,default:true}
};
export function effectGrid(count,available,iconSize,gap=4){
  if(!count)return {columns:0,rows:0,width:0,expansion:0};
  const capacity=Math.max(1,Math.floor((available+gap)/(iconSize+gap)));
  const columns=count<=capacity?count:count<=capacity*2?capacity:Math.ceil(count/2);
  const width=columns*(iconSize+gap)-gap;
  return {columns,rows:count<=capacity?1:2,width,expansion:count>capacity*2?Math.max(0,2*(width-available)):0};
}
export function collectEffects(actor,prefs,showIcon){
  const seen=new Set(),groups=[[],[],[],[],[]];
  const add=(effect,itemEffect=false)=>{
    if(seen.has(effect.uuid))return;seen.add(effect.uuid);
    if(effect.isSuppressed||effect.showIcon===showIcon.NEVER)return;
    if(effect.showIcon!==showIcon.ALWAYS&&((prefs.hideDisabled&&effect.disabled)||(prefs.hidePassive&&!effect.isTemporary)))return;
    const group=itemEffect?(effect.disabled?4:3):effect.disabled?2:effect.isTemporary?0:1;
    groups[group].push({effect,itemEffect});
  };
  for(const effect of actor.allApplicableEffects())add(effect);
  for(const item of actor.items??[])for(const effect of item.allApplicableEffects?.()??[])add(effect,true);
  return groups.flat();
}
export function canEditEffect(effect,prefs,user){return !!effect.isOwner&&(user.isGM||prefs.playerClicks);}
