import test from 'node:test';
import assert from 'node:assert/strict';
import {classResources} from '../scripts/resources.js';
import {economy,consume,setEconomy,canSpend,changeSpellSlots} from '../scripts/state.js';
const feature=(id,name,identifier,max,spent=0)=>({id,type:'feat',name,system:{identifier,uses:{max,spent}}});
test('manual spell slots serialize clicks, clamp at empty/full, and keep pact slots independent',async()=>{
  const spells={spell1:{value:2,max:4},pact:{value:1,max:2}},writes=[];
  const ctx={document:{uuid:'Scene.test.Token.caster'},actor:{system:{spells},update:async changes=>{
    await new Promise(resolve=>setTimeout(resolve,2));
    for(const [path,value] of Object.entries(changes)){writes.push(path);spells[path.split('.')[2]].value=value;}
  }}};
  await Promise.all([changeSpellSlots(ctx,'spell1'),changeSpellSlots(ctx,'spell1')]);
  assert.equal(spells.spell1.value,0);assert.equal(spells.pact.value,1);
  await changeSpellSlots(ctx,'spell1');assert.equal(writes.length,2);
  await changeSpellSlots(ctx,'pact',true);await changeSpellSlots(ctx,'pact',true);
  assert.equal(spells.pact.value,2);assert.equal(writes.length,3);
  await changeSpellSlots(ctx,'spell1',true);assert.equal(spells.spell1.value,1);
  await changeSpellSlots(ctx,'spell9');await changeSpellSlots(ctx,'invalid.path');
  assert.equal(writes.length,4);
});
test('multiclass pools use prepared feature uses and avoid duplicate actor resources',()=>{
  const monk=feature('m','Renamed monk feature','monks-focus',12,4),sorcerer=feature('s','Font of Magic','font-of-magic',6,2);
  const actor={items:[monk,sorcerer,feature('x','Focused Aim','focused-aim',1)],system:{resources:{primary:{label:'Focus points',max:12,value:12}}}};
  assert.deepEqual(classResources(actor).map(r=>[r.kind,r.value,r.max]),[['monk',8,12],['sorcery',4,6]]);
  sorcerer.system.uses.spent=6;assert.equal(classResources(actor)[1].value,0);
  sorcerer.system.uses.spent=0;assert.equal(classResources(actor)[1].value,6);
});
test('Ki, activity uses, and legacy labeled resources retain their actual pool',()=>{
  const ki=feature('ki','Ki','monks-focus',7,3);
  assert.equal(classResources({items:[ki]})[0].name,'Ki points');
  const font=feature('font','Sorcery points','sorcery-points','');
  font.system.activities=[{id:'pool',uses:{max:4,value:2}}];
  assert.equal(classResources({items:[font]})[0].activityId,'pool');
  const legacy=classResources({items:[],system:{resources:{primary:{label:'Ki points',max:8,value:0}}}})[0];
  assert.equal(legacy.resourceKey,'primary');assert.equal(legacy.value,0);
  assert.deepEqual(classResources({items:[feature('f','Font of Magic','font-of-magic','@scale.sorcerer.points')]}),[]);
});
test('Metamagic Adept grants sorcery pips to a noncaster without class or spell-slot requirements',()=>{
  const actor={classes:{fighter:{}},items:[feature('adept','Metamagic Adept','metamagic-adept',2,1)],system:{spells:{spell1:{max:0,value:0}}}};
  assert.deepEqual(classResources(actor).map(r=>[r.kind,r.value,r.max]),[['sorcery',1,2]]);
});
function setup(){
  let saved,actions={};
  const actor={type:'character',items:[],classes:{},getFlag:(_scope,key)=>key==='actions'?actions:undefined};
  const ctx={actor,token:{id:'hero',parent:{id:'scene'}},document:{uuid:'Actor.resource-test',getFlag:()=>saved,setFlag:async(_s,_k,v)=>{saved=structuredClone(v);}}};
  globalThis.game={combat:{id:'fight',started:true,round:1,turn:0,turns:[{id:'guard-c',tokenId:'guard',sceneId:'scene'},{id:'hero-c',tokenId:'hero',sceneId:'scene'}]},modules:new Map()};
  return {ctx,actions};
}
test('without Midi installed, reaction remains spent across other turns and round boundaries, refreshing only at own turn',async()=>{
  const {ctx}=setup();
  await consume(ctx,'reaction');assert.equal(canSpend(ctx,'reaction'),false);
  assert.equal(economy(ctx).action,1);assert.equal(economy(ctx).bonus,1);
  game.combat.turn=1;assert.equal(economy(ctx).reaction,1);
  await consume(ctx,'reaction');game.combat.round=2;game.combat.turn=0;
  assert.equal(economy(ctx).reaction,0);
  await setEconomy(ctx,'reaction',true);assert.equal(economy(ctx).reaction,1);
  await consume(ctx,'reaction');game.combat.turn=1;assert.equal(economy(ctx).reaction,1);
  delete globalThis.game;
});
test('Midi is the reaction authority; its workflows are not charged a second time',async()=>{
  const {ctx,actions}=setup();let calls=0;
  game.modules.set('midi-qol',{active:true});
  globalThis.MidiQOL={configSettings:()=>({enforceReactions:'all'}),setReactionUsed:async()=>{actions.reactionsUsed=(actions.reactionsUsed??0)+1;calls++;},removeReactionUsed:async()=>{actions.reactionsUsed=0;}};
  await setEconomy(ctx,'reaction');assert.equal(economy(ctx).reaction,0);
  await consume(ctx,'reaction');assert.equal(calls,1);
  await setEconomy(ctx,'reaction',true);assert.equal(economy(ctx).reaction,1);
  actions.reactionsUsed=1;assert.equal(economy(ctx).reaction,0);
  actions.reactionsMax=2;assert.equal(economy(ctx).reaction,1);
  delete globalThis.MidiQOL;delete globalThis.game;
});

test('installed Midi with reaction tracking disabled uses the native counter',async()=>{
  const {ctx}=setup();game.modules.set('midi-qol',{active:true});
  globalThis.MidiQOL={configSettings:()=>({enforceReactions:'none'}),setReactionUsed:()=>assert.fail('Midi must not spend'),removeReactionUsed:()=>assert.fail('Midi must not restore')};
  await consume(ctx,'reaction');assert.equal(economy(ctx).reaction,0);
  await setEconomy(ctx,'reaction',true);assert.equal(economy(ctx).reaction,1);
  delete globalThis.MidiQOL;delete globalThis.game;
});
