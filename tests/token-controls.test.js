import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultLayout} from '../scripts/model.js';
import {renameFromBar,movementChoices,setMovement,sightChoices,setSight,resetSight,applySightPreference,registerSightPreference} from '../scripts/token-controls.js';
import {groupColors} from '../scripts/groups.js';

function fixture(t,linked=true){
  const originals=Object.fromEntries(['CONFIG','foundry','Hooks','libWrapper'].map(k=>[k,globalThis[k]]));
  t.after(()=>{for(const [k,v] of Object.entries(originals))if(v===undefined)delete globalThis[k];else globalThis[k]=v;});
  globalThis.CONFIG={Token:{movement:{actions:{walk:{label:'Walk'},fly:{label:'Fly'},swim:{label:'Swim'},burrow:{label:'Burrow',canSelect:()=>false}}}},DND5E:{senses:{blindsight:{detectionMode:'blindsight'}}},Canvas:{visionModes:{basic:{vision:{defaults:{saturation:0}}},darkvision:{vision:{defaults:{saturation:-1}}}},detectionModes:{blindsight:{label:'Blindsight'},seeInvisibility:{label:'See Invisibility'}}}};
  const flags={layout:defaultLayout()},writes={actor:[],token:[]};
  const actor={isOwner:true,name:'Actor',items:[],system:{attributes:{movement:{speeds:{walk:30,fly:60,swim:0,burrow:20}},senses:{ranges:{darkvision:60,blindsight:10}}}},getFlag:(_s,k)=>flags[k],update:async changes=>writes.actor.push(changes)};
  const source={sight:{enabled:true,range:0,visionMode:'basic',saturation:0},detectionModes:{seeInvisibility:{enabled:true,range:30}}};
  const token={uuid:'Token.test',actor,actorLink:linked,name:'Token',movementAction:'walk',sight:structuredClone(source.sight),detectionModes:structuredClone(source.detectionModes),_source:source,getFlag:(_s,k)=>flags[k],update:async changes=>{writes.token.push(changes);if(changes['flags.bg3-combat-bar.sightProfile'])flags.sightProfile=structuredClone(changes['flags.bg3-combat-bar.sightProfile']);}};
  return {ctx:{actor,token,document:linked?actor:token},writes,flags};
}

test('unlinked name edits update only the token; linked edits require an explicit scope',async t=>{
  const h=fixture(t,false);await renameFromBar(h.ctx,' Scout ');assert.deepEqual(h.writes.token,[{name:'Scout'}]);assert.deepEqual(h.writes.actor,[]);
  h.ctx.token.actorLink=true;let answer='cancel';
  globalThis.foundry={applications:{api:{DialogV2:{wait:async()=>({button:answer})}}}};
  await renameFromBar(h.ctx,'Cancel');assert.equal(h.writes.token.length,1);
  answer='actor';await renameFromBar(h.ctx,'Hero');assert.deepEqual(h.writes.actor,[{name:'Hero'}]);assert.equal(h.writes.token.length,1);
  answer='token';await renameFromBar(h.ctx,'Disguise');assert.deepEqual(h.writes.token.at(-1),{name:'Disguise'});assert.equal(h.writes.actor.length,1);
  h.flags.layout.locked=true;await renameFromBar(h.ctx,'Ignored');assert.equal(h.writes.token.length,2);
});
test('movement filters actual speeds and native permissions and updates only movementAction',async t=>{
  const h=fixture(t);assert.deepEqual(movementChoices(h.ctx).map(c=>c.id),['walk','fly']);
  await setMovement(h.ctx,'fly');assert.deepEqual(h.writes.token,[{movementAction:'fly'}]);assert.deepEqual(h.writes.actor,[]);
  await assert.rejects(()=>setMovement(h.ctx,'swim'),/not available/);
  h.ctx.actor.system.attributes.movement={walk:30,fly:40};assert.equal(movementChoices(h.ctx)[1].speed,40);
  delete h.ctx.token.movementAction;assert.deepEqual(movementChoices(h.ctx),[]);
});
test('sight choices include owned senses and configured detection modes without granting arbitrary vision',async t=>{
  const h=fixture(t),options=sightChoices(h.ctx);
  assert.deepEqual(options.vision.map(c=>c.id),['basic','darkvision']);assert.deepEqual(options.detection.map(c=>c.id),['seeInvisibility','blindsight']);
  await setSight(h.ctx,'darkvision');assert.equal(h.writes.token.at(-1)['sight.range'],60);assert.equal(h.writes.token.at(-1)['sight.saturation'],-1);
  await assert.rejects(()=>setSight(h.ctx,'tremorsense'),/not available/);assert.deepEqual(h.writes.actor,[]);
});
test('D&D 6 derived vision respects token selection without changing actor senses',async t=>{
  const h=fixture(t);await setSight(h.ctx,'basic');await setSight(h.ctx,'blindsight',{detection:true});
  h.ctx.token.sight={enabled:true,visionMode:'darkvision',range:60,saturation:-1};h.ctx.token.detectionModes.blindsight={range:10,enabled:true};h.ctx.token.detectionModes.basicSight={range:60,enabled:true};
  applySightPreference(h.ctx.token);
  assert.equal(h.ctx.token.sight.visionMode,'basic');assert.equal(h.ctx.token.sight.range,0);assert.equal(h.ctx.token.detectionModes.blindsight.enabled,false);assert.equal(h.ctx.token.detectionModes.seeInvisibility.enabled,true);assert.equal(h.ctx.actor.system.attributes.senses.ranges.darkvision,60);
  await resetSight(h.ctx);assert.equal(h.writes.token.at(-1)['flags.bg3-combat-bar.-=sightProfile'],null);assert.deepEqual(h.writes.token.at(-1).sight,h.ctx.token._source.sight);
});
test('v13 detection arrays preserve unrelated modes and restore original data',async t=>{
  const h=fixture(t);h.ctx.token.detectionModes=h.ctx.token._source.detectionModes=[{id:'seeInvisibility',range:30,enabled:false}];
  await setSight(h.ctx,'blindsight',{detection:true});
  assert.deepEqual(h.writes.token.at(-1).detectionModes[0],{id:'seeInvisibility',range:30,enabled:false});
  await resetSight(h.ctx);assert.deepEqual(h.writes.token.at(-1).detectionModes,h.ctx.token._source.detectionModes);
});
test('D&D sense integration chains native preparation and releases control for manual token configuration',async t=>{
  const h=fixture(t);await setSight(h.ctx,'basic');const handlers={};let native=0;
  class Token{_applySenseVision(){native++;this.sight.range=60;this.sight.visionMode='darkvision';}}
  CONFIG.Token.documentClass=Token;globalThis.Hooks={on:(name,fn)=>handlers[name]=fn};
  registerSightPreference();const token=Object.assign(new Token(),h.ctx.token);token._applySenseVision();assert.equal(native,1);assert.equal(token.sight.range,0);
  const changes={'sight.range':90};handlers.preUpdateToken(token,changes,{});assert.equal(changes['flags.bg3-combat-bar.-=sightProfile'],null);
  const selection={'sight.range':60};handlers.preUpdateToken(token,selection,{bg3SightSelection:true});assert.equal(selection['flags.bg3-combat-bar.-=sightProfile'],undefined);
});
test('adjacent horizontal and vertical groups receive different colors, independent of storage order',()=>{
  const groups=[{id:'a',section:'items',slots:[0,1]},{id:'b',section:'items',slots:[2,3]},{id:'c',section:'items',slots:[12,13]}];
  const colors=groupColors(groups);assert.notEqual(colors.get('a'),colors.get('b'));assert.notEqual(colors.get('a'),colors.get('c'));assert.notEqual(colors.get('b'),colors.get('c'));assert.deepEqual(groupColors([...groups].reverse()),colors);
});
