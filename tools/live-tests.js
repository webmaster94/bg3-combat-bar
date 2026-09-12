import {ID} from '../scripts/model.js';
import {context,layout,editLayout,economy,consume,actionCost,equipLoadout} from '../scripts/state.js';
import {generic,executeRequest,cleanupEffects,validDestination} from '../scripts/actions.js';
if(!['127.0.0.1','localhost'].includes(location.hostname)||!game.user.isGM)throw Error('Local GM tests only.');
const results=[];
const check=(condition,message)=>{if(!condition)throw Error(message);};
const test=async(name,fn)=>{try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});console.error('BG3 live test',name,e);}};
const actor=game.actors.find(a=>a.getFlag(ID,'fixture')==='hero');
const source=canvas.scene.tokens.find(t=>t.actorId===actor.id),target=canvas.scene.tokens.find(t=>t.actor?.getFlag(ID,'fixture')==='target');
const ctx=context(source),combat=game.combat,original=actor.toObject(),targetStart={x:target.x,y:target.y};
const index=combat.turns.findIndex(c=>c.tokenId===source.id);
await combat.update({turn:index,round:Math.max(1,combat.round)+1});
await actor.update({'system.abilities.str.value':30});
await game.togglePause(false,true);
const fixes={'Moonlit longsword':'icons/weapons/swords/sword-runed-glowing.webp','Ray of frost':'icons/magic/water/strike-ice-blades.webp','Potion of healing':'icons/consumables/potions/potion-flask-stopped-red.webp','Alchemist’s fire':'icons/consumables/potions/potion-jar-corked-orange.webp'};
await actor.updateEmbeddedDocuments('Item',actor.items.filter(i=>fixes[i.name]).map(i=>({_id:i.id,img:fixes[i.name]})));
await test('Loadout switching equips selected weapons and unequips managed alternatives',async()=>{
  await editLayout(ctx,d=>equipLoadout(ctx,d,'melee',0));check(actor.items.get(layout(ctx).weapons.melee[0][0]).system.equipped,'Melee weapon not equipped');
  await editLayout(ctx,d=>equipLoadout(ctx,d,'ranged',0));check(!actor.items.get(layout(ctx).weapons.melee[0][0]).system.equipped,'Melee weapon remained equipped');check(actor.items.get(layout(ctx).weapons.ranged[0][0]).system.equipped,'Ranged weapon not equipped');await editLayout(ctx,d=>equipLoadout(ctx,d,'melee',0));
});
await test('Feature Active Effect changes Hide to a bonus action',async()=>{
  const feature=actor.items.find(i=>i.name==='Second wind');const [e]=await feature.createEmbeddedDocuments('ActiveEffect',[{name:'BG3 test Cunning Action',transfer:true,changes:[{key:`flags.${ID}.hideAsBonusAction`,mode:5,value:'true',priority:20}]}]);
  try{check(actionCost(actor,'hide')==='bonus','Transferred flag did not change cost');}finally{await e.delete();}
});
await test('Dash increases movement, expires after turn, and action refreshes only on own turn',async()=>{
  const speed=actor.system.attributes.movement.walk;await generic(ctx,'dash');check(actor.system.attributes.movement.walk===speed*2,'Dash did not increase speed');check(economy(ctx).action===0,'Dash did not consume action');
  await combat.nextTurn();await cleanupEffects();check(economy(ctx).action===0,'Action refreshed on another actor turn');check(actor.system.attributes.movement.walk===speed,'Dash effect did not expire');await combat.nextTurn();check(economy(ctx).action===1,'Action did not refresh on own turn');
});
await test('Invalid shove destinations are rejected',async()=>{check(!validDestination(source,target,{x:source.x,y:source.y}),'Occupied square accepted');check(!validDestination(source,target,{x:target.x+300,y:target.y}),'Distant square accepted');});
await test('Failed NPC save automatically moves the token 5 feet and consumes an attack',async()=>{
  const end={x:target.x+100,y:target.y};check(validDestination(source,target,end),'Expected destination invalid');await executeRequest({action:'shove',source:source.uuid,target:target.uuid,destination:end},game.user);check(target.x===end.x&&target.y===end.y,'Token not moved');check(economy(ctx).action===0,'Shove action not consumed');await target.move({...targetStart,action:'displace'});await combat.nextTurn();await combat.nextTurn();
});
await test('Failed NPC save applies Grappled, leaving reach removes it',async()=>{
  await executeRequest({action:'grapple',source:source.uuid,target:target.uuid},game.user);check(target.actor.statuses.has('grappled'),'Grappled condition missing');await target.move({x:target.x+300,y:target.y,action:'displace'});await cleanupEffects();check(!target.actor.effects.some(e=>e.getFlag(ID,'kind')==='grapple'),'Grapple not removed outside reach');await target.move({...targetStart,action:'displace'});await combat.nextTurn();await combat.nextTurn();
});
await test('Unlinked token layouts stay independent of the base actor and other copies',async()=>{
  const [copy]=await canvas.scene.createEmbeddedDocuments('Token',[{...target.toObject(),_id:undefined,x:target.x+400}]);
  try{await editLayout(context(target),d=>{d.pages[0].features[0]='test-only';});check(layout(context(copy)).pages[0].features[0]!=='test-only','Copied token inherited later mutation');check(!target.baseActor.getFlag(ID,'layout'),'Base actor was modified');await editLayout(context(target),d=>{d.pages[0].features[0]=null;});}finally{await copy.delete();}
});
await test('Tooltip enriches item description and activity details',async()=>{const html=await game.modules.get(ID).api.bar.itemTooltip(ctx,actor.items.find(i=>i.name==='Magic missile'));check(html.includes('Magic missile')&&html.includes('arcane light'),'Tooltip did not contain description');});
await test('System spell use consumes a slot and an action',async()=>{
  await combat.update({turn:index,round:combat.round+1});
  const item=actor.items.find(i=>i.name==='Magic missile');await item.update({'system.method':'spell','system.prepared':1});
  const before=actor.system.spells.spell1.value;console.log('BG3 spell activity data',JSON.stringify(item.system.activities.map(a=>({name:a.name,canUse:a.canUse,type:a.type,activation:a.activation,consumption:a.consumption}))));
  await item.use({subsequentActions:false},{configure:false});await new Promise(resolve=>setTimeout(resolve,250));
  check(actor.system.spells.spell1.value===before-1,'Spell slot was not consumed');check(economy(ctx).action===0,'Spell did not consume action');
  await actor.update({'system.spells.spell1.value':before});
});
await actor.update({'system.abilities.str.value':original.system.abilities.str.value});
await combat.update({turn:index,round:combat.round+1});source.object.control({releaseOthers:true});game.modules.get(ID).api.refresh();
console.log('BG3_TEST_RESULTS',JSON.stringify(results));
const dialog=document.createElement('dialog');dialog.className='bg3-dialog';dialog.innerHTML=`<header><h2>BG3 live test results</h2></header><div class="bg3-dialog-body"><p>${results.filter(r=>r.pass).length}/${results.length} passed · Midi-QOL ${game.modules.get('midi-qol')?.active?'active':'inactive'}</p>${results.map(r=>`<p>${r.pass?'PASS':'FAIL'}: ${r.name}${r.error?' · '+r.error:''}</p>`).join('')}</div><footer><button>Close</button></footer>`;dialog.querySelector('button').onclick=()=>{dialog.close();dialog.remove();};document.body.append(dialog);dialog.showModal();
