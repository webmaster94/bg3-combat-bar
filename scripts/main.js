import {ID,turnKey} from "./model.js";
import {context,layout,editLayout,consume,canSpend,economy,isTurn,midiReactions} from "./state.js";
import {CombatBar} from "./bar.js";
import {registerRequests,cleanupEffects,clearHidden} from "./actions.js";

let bar;
function selectedContext(){
  const controlled=canvas.tokens?.controlled??[];
  const token=controlled.find(t=>t.document.uuid===bar?.ctx?.token?.uuid)??controlled[0];
  if(token)return context(token.document);
  const current=game.combat?.combatant?.token;
  if(current?.actor?.isOwner)return context(current);
  const own=canvas.tokens?.placeables.find(t=>t.actor?.id===game.user.character?.id);
  return own?context(own.document):null;
}
function refresh(){if(bar)bar.setContext(selectedContext());}
function activityContext(activity){
  const actor=activity?.actor;if(!actor?.isOwner)return null;
  if(bar?.ctx?.actor?.uuid===actor.uuid)return bar.ctx;
  if(actor.token)return context(actor.token);
  const tokens=actor.getActiveTokens?.(false,true)??[];
  return tokens.length===1?context(tokens[0]):null;
}
function activityCost(activity){
  const activation=activity.activation?.type;
  if(activation?.startsWith('reaction'))return 'reaction';
  if(activation==='bonus')return 'bonus';
  if(activation!=='action')return null;
  return activity.type==='attack'&&activity.item.type==='weapon'?'attack':'action';
}
Hooks.once('init',()=>{
  game.settings.register(ID,'outsideCombat',{name:'Show outside combat',hint:'GM setting for everyone: show the bar whenever an owned character token is selected. Applies immediately.',scope:'world',config:true,type:Boolean,default:false,requiresReload:false,onChange:refresh});
  game.settings.register(ID,'scale',{name:'Bar scale',hint:'Your personal bar size. Applies immediately without reloading.',scope:'client',config:true,type:Number,range:{min:0.55,max:1.4,step:0.05},default:0.85,requiresReload:false,onChange:()=>bar?.applyScale()});
  game.settings.register(ID,'trackSheetActions',{name:'Track actions used from character sheets',hint:'Also update action counters when a system activity is used outside the bar.',scope:'world',config:true,type:Boolean,default:true});
  game.keybindings.register(ID,'toggleMacroBar',{name:'Swap combat and macro bars',editable:[{key:'KeyB',modifiers:['Shift']}],onDown:()=>{if(!bar?.visible())return false;bar.macroMode=!bar.macroMode;bar.render();return true;}});
});
Hooks.once('ready',()=>{
  if(game.system.id!=='dnd5e')return;
  bar=new CombatBar();game.modules.get(ID).api={bar,refresh,context,layout,economy};
  registerRequests();refresh();
});
for(const hook of ['canvasReady','controlToken','updateActor','updateToken','createItem','updateItem','deleteItem','createActiveEffect','updateActiveEffect','deleteActiveEffect','createCombat','deleteCombat','updateCombatant','createCombatant','deleteCombatant'])Hooks.on(hook,refresh);
Hooks.on('controlToken',(token,controlled)=>{if(controlled&&bar)bar.setContext(context(token.document));});
Hooks.on('canvasTearDown',()=>bar?.setContext(null));
Hooks.on('updateCombat',async(combat,changes)=>{
  refresh();
  if(game.users.activeGM?.id!==game.user.id)return;
  await cleanupEffects();
  if(!('turn' in changes||'round' in changes))return;
  const ctx=context(combat.combatant?.token);if(!ctx)return;
  if(layout(ctx).resources.some(r=>r.reset==='turn'))await editLayout(ctx,d=>{for(const r of d.resources)if(r.reset==='turn')r.value=r.max;});
});
Hooks.on('deleteCombat',()=>cleanupEffects());
Hooks.on('updateToken',(_token,changes)=>{if('x' in changes||'y' in changes||'elevation' in changes)cleanupEffects();});
Hooks.on('updateActor',()=>cleanupEffects());
Hooks.on('dnd5e.preUseActivity',(activity)=>{
  const ctx=activityContext(activity),cost=activityCost(activity);if(!ctx||!cost)return;
  if(cost==='reaction'&&midiReactions(ctx.actor))return;
  if(!game.settings.get(ID,'trackSheetActions')&&bar?.usingActor!==ctx.actor.uuid)return;
  if(!canSpend(ctx,cost)){ui.notifications.warn('That action is spent. Right-click its resource on the combat bar to restore it.');return false;}
});
Hooks.on('dnd5e.postUseActivity',(activity,_config,results)=>{
  const ctx=activityContext(activity),cost=activityCost(activity);
  if(!ctx||!results)return;
  if(cost&&(game.settings.get(ID,'trackSheetActions')||bar?.usingActor===ctx.actor.uuid))consume(ctx,cost).catch(e=>ui.notifications.warn(e.message));
  if(activity.item.type==='spell'&&activity.item.system.properties.has('vocal'))clearHidden(ctx.actor);
  refresh();
});
Hooks.on('dnd5e.rollAttack',(_rolls,{subject}={})=>{if(subject?.actor?.isOwner)clearHidden(subject.actor);});
Hooks.on('dnd5e.restCompleted',async(actor,result)=>{
  if(!actor.isOwner)return;
  const ctx=actor.token?context(actor.token):bar?.ctx?.actor?.uuid===actor.uuid?bar.ctx:{actor,document:actor};
  await editLayout(ctx,d=>{for(const r of d.resources)if(!r.itemId&&(r.reset==='short'||(result.longRest&&r.reset==='long')))r.value=r.max;});
  refresh();
});
window.addEventListener('resize',()=>bar?.schedule());
