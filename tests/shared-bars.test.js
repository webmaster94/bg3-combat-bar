import test from 'node:test';
import assert from 'node:assert/strict';
import {ID,defaultLayout} from '../scripts/model.js';
import {context,layout,editLayout,setCustomBar,initializeSharedBars,economy,consume,canSpend,equipLoadout,changeSpellSlots} from '../scripts/state.js';
import {layoutDocument,droppedItem} from '../scripts/layout-storage.js';
import {sectionDefinitions,hideSection} from '../scripts/sections.js';
import {CombatBar} from '../scripts/bar.js';

function document(uuid,flags={}){
  const d={uuid,id:uuid.split('.').at(-1),name:uuid,isOwner:true,flags:{[ID]:structuredClone(flags)},writes:[]};
  d.getFlag=(scope,key)=>d.flags[scope]?.[key];
  d.update=async changes=>{d.writes.push(structuredClone(changes));for(const [path,value] of Object.entries(changes)){const parts=path.split('.'),last=parts.pop();let object=d;for(const key of parts)object=object[key]??={};object[last]=structuredClone(value);}return d;};
  d.setFlag=(scope,key,value)=>d.update({[`flags.${scope}.${key}`]:value});
  return d;
}
function setup(t,{template=true}={}){
  const originalGame=globalThis.game,originalFoundry=globalThis.foundry;
  t.after(()=>{if(originalGame===undefined)delete globalThis.game;else globalThis.game=originalGame;if(originalFoundry===undefined)delete globalThis.foundry;else globalThis.foundry=originalFoundry;});
  const initial=defaultLayout(['custom-kit']);initial.resources=[{name:'Focus',max:3,value:3,reset:'long'}];
  const base=document('Actor.goblin',template?{layout:initial,characterSections:{custom:[{id:'custom-kit',name:'Shared Kit',visible:true}]}}:{});
  const makeItems=()=>{const items=new Map([['stab',{id:'stab',name:'Stab',type:'feat',system:{uses:{max:3,spent:0},activities:[]}}],['sword',{id:'sword',name:'Sword',type:'weapon',system:{type:{value:'simpleM'},equipped:false,activities:[]}}]]);items.some=fn=>[...items.values()].some(fn);return items;};
  const actorFields=()=>({type:'npc',classes:{},items:makeItems(),system:{attributes:{hp:{value:10,max:10}},spells:{spell1:{max:2,value:2}}}});
  Object.assign(base,actorFields());for(const item of base.items.values())item.actor=base;
  const tokens=['one','two'].map(id=>{
    const token=Object.assign(document(`Scene.${id}.Token.${id}`),{actorId:base.id,actorLink:false,baseActor:base,parent:{id}});
    const actor=Object.assign(document(`${token.uuid}.Actor.goblin`),actorFields(),{token});
    actor.updateEmbeddedDocuments=async(_type,updates)=>{for(const u of updates)actor.items.get(u._id).system.equipped=u['system.equipped'];};
    for(const item of actor.items.values())item.actor=actor;
    token.actor=actor;return token;
  });
  globalThis.game={settings:{get:(_scope,key)=>key==='defaultSections'?[]:false},actors:new Map([[base.id,base]]),modules:new Map(),user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},scenes:tokens.map(token=>({tokens:[token]})),combat:{id:'combat',started:true,round:1,turn:0,turns:tokens.map(token=>({id:`c-${token.id}`,tokenId:token.id,sceneId:token.parent.id}))}};
  globalThis.foundry={utils:{deepClone:structuredClone}};
  return {base,tokens,a:context(tokens[0]),b:context(tokens[1])};
}

test('unlinked creatures share slots, groups, widths, and section definitions across scenes',async t=>{
  const {a,b,base}=setup(t);assert.equal(layoutDocument(a),base);assert.equal(layoutDocument(b),base);
  await editLayout(a,d=>{d.pages[0].features[0]='stab';d.widths.items=0;d.groups=[{id:'g',section:'features',page:0,name:'Attacks',slots:[0]}];});
  assert.equal(layout(b).pages[0].features[0],'stab');assert.equal(layout(b).widths.items,0);assert.equal(layout(b).groups[0].name,'Attacks');
  assert.equal(sectionDefinitions(b)[0].name,'Shared Kit');await hideSection('custom-kit',a);assert.equal(sectionDefinitions(b)[0].visible,false);
  assert.equal(a.document,a.token,'Combat state storage stays on the token');
});

test('Custom Bar creates an independent snapshot; returning to shared retains the saved custom bar',async t=>{
  const {a,b,base}=setup(t);await editLayout(a,d=>{d.pages[0].features[0]='stab';});
  await setCustomBar(a,true);assert.equal(layoutDocument(a),a.token);assert.equal(layout(a).pages[0].features[0],'stab');
  await editLayout(a,d=>{d.pages[0].features[0]='private';d.widths.items=77;});
  await hideSection('custom-kit',a);assert.equal(sectionDefinitions(b)[0].visible,true);assert.equal(layout(b).pages[0].features[0],'stab');
  await setCustomBar(a,false);assert.equal(layoutDocument(a),base);assert.equal(layout(a).pages[0].features[0],'stab');
  await editLayout(b,d=>{d.pages[0].features[0]='updated';});assert.equal(layout(a).pages[0].features[0],'updated');
  await setCustomBar(a,true);assert.equal(layout(a).pages[0].features[0],'private');assert.equal(layout(a).widths.items,77);assert.equal(sectionDefinitions(a)[0].visible,false);
});

test('shared layout never shares action counters, spell slots, HP, custom-counter values, or view state',async t=>{
  const {a,b,base}=setup(t);await consume(a,'action');assert.equal(economy(a).action,0);assert.equal(economy(b).action,1);assert.equal(base.getFlag(ID,'economy'),undefined);
  await changeSpellSlots(a,'spell1');assert.equal(a.actor.system.spells.spell1.value,1);assert.equal(b.actor.system.spells.spell1.value,2);assert.equal(base.system.spells.spell1.value,2);
  await a.actor.update({'system.attributes.hp.value':4});assert.equal(b.actor.system.attributes.hp.value,10);
  const before=base.writes.length;
  await editLayout(a,d=>{d.resources[0].value=1;d.page=4;d.locked=true;});
  assert.equal(layout(a).resources[0].value,1);assert.equal(layout(b).resources[0].value,3);assert.equal(layout(b).page,0);assert.equal(layout(b).locked,false);assert.equal(base.writes.length,before);
  await editLayout(b,d=>{d.resources[0].value=2;});await editLayout(a,d=>{d.resources[0].value=d.resources[0].max;});
  assert.equal(layout(a).resources[0].value,3);assert.equal(layout(b).resources[0].value,2);
});

test('custom-counter identity survives removing another shared counter',async t=>{
  const {a,b}=setup(t);await editLayout(a,d=>{d.resources.push({name:'Second',max:5,value:5,reset:'short'});});
  await editLayout(b,d=>{d.resources[1].value=2;});const id=layout(b).resources[1].id;
  await editLayout(a,d=>{d.resources.splice(0,1);});assert.equal(layout(b).resources[0].id,id);assert.equal(layout(b).resources[0].value,2);
});

test('switching between shared and custom bars preserves distinct same-named counter values',async t=>{
  const {a,b}=setup(t);await editLayout(a,d=>{d.resources.push({name:'Focus',max:3,value:3,reset:'long'});});
  await editLayout(a,d=>{d.resources[0].value=1;d.resources[1].value=2;});
  await setCustomBar(a,true);assert.deepEqual(layout(a).resources.map(r=>r.value),[1,2]);
  await editLayout(a,d=>{d.resources[1].value=0;});await setCustomBar(a,false);
  assert.deepEqual(layout(a).resources.map(r=>r.value),[1,0]);assert.deepEqual(layout(b).resources.map(r=>r.value),[3,3]);
  await editLayout(a,d=>{d.resources[0].value=2;});await setCustomBar(a,true);assert.deepEqual(layout(a).resources.map(r=>r.value),[2,0]);
});

test('shared weapon assignment equips only the selected creature and uses its own item',async t=>{
  const {a,b,base}=setup(t);await editLayout(a,async d=>{d.weapons.melee[0][0]='sword';await equipLoadout(a,d,'melee',0);});
  assert.equal(layout(b).weapons.melee[0][0],'sword');assert.equal(a.actor.items.get('sword').system.equipped,true);assert.equal(b.actor.items.get('sword').system.equipped,false);assert.equal(base.items.get('sword').system.equipped,false);
  assert.equal(droppedItem(a,base.items.get('stab')),a.actor.items.get('stab'));assert.equal(droppedItem(a,b.actor.items.get('stab')),null);
  assert.notEqual(a.actor.items.get('stab'),b.actor.items.get('stab'));
});

test('concurrent edits through different tokens preserve both changes to the shared template',async t=>{
  const {a,b}=setup(t);await Promise.all([editLayout(a,async d=>{await new Promise(r=>setTimeout(r,5));d.pages[0].features[0]='one';}),editLayout(b,d=>{d.pages[0].features[1]='two';})]);
  assert.deepEqual(layout(a).pages[0].features.slice(0,2),['one','two']);assert.deepEqual(layout(b).pages[0].features.slice(0,2),['one','two']);
});

test('legacy bars seed an empty represented actor once and remain available as custom bars',async t=>{
  const {a,b,base}=setup(t,{template:false});
  const one=defaultLayout(),two=defaultLayout();one.pages[0].features[0]='one';two.pages[0].features[0]='two';
  one.resources=[{name:'Focus',value:1,max:3,reset:'long'}];two.resources=[{name:'Focus',value:2,max:3,reset:'long'}];
  await a.token.setFlag(ID,'layout',one);await b.token.setFlag(ID,'layout',two);
  await initializeSharedBars();assert.equal(layout(a).pages[0].features[0],'one');assert.equal(layout(b).pages[0].features[0],'one');
  assert.equal(layout(a).resources[0].value,1);assert.equal(layout(b).resources[0].value,2);assert.deepEqual(b.token.getFlag(ID,'layout'),two);
  const writes=base.writes.length+a.token.writes.length+b.token.writes.length;await initializeSharedBars();assert.equal(base.writes.length+a.token.writes.length+b.token.writes.length,writes);
  await setCustomBar(b,true);assert.equal(layout(b).pages[0].features[0],'two');assert.equal(layout(a).pages[0].features[0],'one');
});

test('migration does not publish a retained custom override into an empty shared bar',async t=>{
  const {a,base}=setup(t,{template:false});await setCustomBar(a,true);await editLayout(a,d=>{d.pages[0].features[0]='private';});await setCustomBar(a,false);
  await initializeSharedBars();assert.equal(base.getFlag(ID,'layout'),undefined);assert.equal(layout(a).pages[0].features[0],null);
});

test('legacy migration retains both existing actor sections and the seeded token sections',async t=>{
  const {a,base}=setup(t,{template:false});
  await base.setFlag(ID,'characterSections',{custom:[{id:'custom-base',name:'Base',visible:true}],hiddenGlobal:['custom-global']});
  await a.token.setFlag(ID,'characterSections',{custom:[{id:'custom-old',name:'Old',visible:true}]});
  const old=defaultLayout(['custom-old']);old.pages[0]['custom-old'][0]='stab';await a.token.setFlag(ID,'layout',old);
  await initializeSharedBars();assert.deepEqual(sectionDefinitions(a).map(s=>s.id),['custom-base','custom-old']);
  assert.equal(layout(a).pages[0]['custom-old'][0],'stab');assert.deepEqual(base.getFlag(ID,'characterSections').hiddenGlobal,['custom-global']);
});

test('override controls exist only for unlinked creatures in Build mode',async t=>{
  const {a,base}=setup(t),bar=new CombatBar();assert.match(bar.barSourceControl(a),/Customize This Token/);
  await setCustomBar(a,true);assert.match(bar.barSourceControl(a),/Use Shared Bar/);
  await editLayout(a,d=>{d.locked=true;});assert.equal(bar.barSourceControl(a),'');
  const linked=context({actor:base,actorLink:true});assert.equal(bar.barSourceControl(linked),'');
});

test('a pending edit cannot write to a different bar source after an override change',async t=>{
  const {a,base}=setup(t);const before=structuredClone(base.getFlag(ID,'layout'));
  await assert.rejects(()=>editLayout(a,async d=>{d.pages[0].features[0]='wrong';await a.token.update({[`flags.${ID}.customBar`]:true,[`flags.${ID}.layout`]:defaultLayout()});}),/source changed/);
  assert.deepEqual(base.getFlag(ID,'layout'),before);
});

test('disabled action enforcement still tracks each shared-bar creature independently',async t=>{
  const {a,b}=setup(t);game.settings.get=(_s,key)=>key==='disableActionEnforcement';
  await consume(a,'action');await consume(a,'action');assert.equal(canSpend(a,'action'),true);assert.equal(economy(a).action,0);assert.equal(economy(b).action,1);
});
