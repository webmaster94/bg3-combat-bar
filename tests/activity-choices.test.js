import test from 'node:test';
import assert from 'node:assert/strict';
import {usableActivities} from '../scripts/activities.js';
import {CombatBar} from '../scripts/bar.js';

test('Midi automation-only follow-up does not create a Chromatic Orb activity menu',()=>{
  globalThis.game={modules:new Map([['midi-qol',{active:true}]])};
  const primary={id:'cast',canUse:true},automatic={id:'bounce',canUse:true,midiProperties:{automationOnly:true}};
  assert.deepEqual(usableActivities({system:{activities:[primary,automatic]}}),[primary]);
});
test('direct click runs the remaining activity without reopening the native selector',async()=>{
  globalThis.game={modules:new Map([['midi-qol',{active:true}]])};
  const bar=new CombatBar(),ctx={actor:{uuid:'Actor.test'},token:{uuid:'Token.test'}};let used=0,menus=0;
  const primary={id:'cast',canUse:true,use:async()=>{used++;return 'cast';}};
  const item={id:'orb',system:{activities:[primary,{id:'bounce',canUse:true,midiProperties:{automationOnly:true}}]},use:()=>{throw Error('Native item selector reopened');}};
  bar.activities.open=()=>{menus++;};
  assert.equal(await bar.useItem(ctx,item,{currentTarget:{isConnected:true}}),'cast');assert.equal(used,1);assert.equal(menus,0);
});

test('CPR hidden rider is excluded while Command retains all five choices',()=>{
  globalThis.game={modules:new Map([['midi-qol',{active:true}],['chris-premades',{active:true}]])};
  const primary={id:'attackChromOrbII',type:'attack',canUse:true};
  const bounce={id:'FppS3cgYVXIYGTVf',type:'attack',canUse:true};
  const orb={flags:{dnd5e:{riders:{activity:[bounce.id]}},'chris-premades':{hiddenActivities:['chromaticOrbBounce'],activityIdentifiers:{chromaticOrbBounce:bounce.id}}},system:{activities:[primary,bounce]}};
  assert.deepEqual(usableActivities(orb),[primary]);
  const options=['Approach','Drop','Flee','Grovel','Halt'].map(id=>({id,type:'save',canUse:true,midiProperties:{automationOnly:false}}));
  assert.deepEqual(usableActivities({system:{activities:options}}),options);
});

test('Midi inactive preserves manual follow-ups and explicit CPR identifiers need no name heuristic',()=>{
  const primary={id:'main',canUse:true},follow={id:'child',canUse:true,identifier:'follow'};
  const item={flags:{'chris-premades':{hiddenActivities:['follow'],activityIdentifiers:{follow:'child'}}},system:{activities:[primary,follow]}};
  globalThis.game={modules:new Map([['midi-qol',{active:true}]])};assert.deepEqual(usableActivities(item),[primary]);
  globalThis.game.modules.get('midi-qol').active=false;assert.deepEqual(usableActivities(item),[primary,follow]);
});
test('Midi sole attack and resolved other activity match native direct-use behavior',()=>{
  globalThis.game={modules:new Map([['midi-qol',{active:true}]])};
  const damage={id:'damage',type:'damage',canUse:true},attack={id:'attack',type:'attack',canUse:true,otherActivity:damage};
  assert.deepEqual(usableActivities({system:{activities:[attack,damage]}}),[attack]);
});

test('an item with only hidden activities cannot fall through to an activity selector',async()=>{
  globalThis.game={modules:new Map([['midi-qol',{active:true}]])};
  const bar=new CombatBar(),ctx={actor:{uuid:'Actor.test'},token:{uuid:'Token.test'}};
  const item={system:{activities:[{canUse:true,midiProperties:{automationOnly:true}}]},displayCard:async()=> 'card',use:()=>{throw Error('Hidden activity surfaced');}};
  assert.equal(await bar.useItem(ctx,item,{}),'card');
});
