import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLayout,matchesItem,resizeSections} from '../scripts/model.js';
import {combineSections,normalizeSections} from '../scripts/sections.js';
import {usableActivities,activityUses} from '../scripts/activities.js';
import {CombatBar} from '../scripts/bar.js';

test('custom section slots survive hide, removal, and another player saving the same actor',()=>{
  const shared='custom-world-kit',mine='custom-player-one',theirs='custom-player-two';
  const d=normalizeLayout({version:2,pages:[{items:['potion']}],order:['items']},[shared,mine]);
  d.pages[0][shared][0]='spell';d.pages[9][mine][71]='feature';d.widths[mine]=119.25;
  const other=normalizeLayout(d,[shared,theirs]);other.pages[0][theirs][2]='sword';
  const again=normalizeLayout(other,[shared,mine]);
  assert.equal(again.pages[0].items[0],'potion');assert.equal(again.pages[0][shared][0],'spell');
  assert.equal(again.pages[9][mine][71],'feature');assert.equal(again.widths[mine],119.25);
  assert.equal(again.pages[0][theirs][2],'sword');assert.deepEqual(normalizeLayout(again,[]),again);
  assert.equal(matchesItem({type:'spell'},shared),true);assert.equal(matchesItem({type:'feat'},mine),true);
  assert.equal(matchesItem({type:'weapon'},shared),true);assert.equal(matchesItem({type:'class'},mine),false);
});
test('GM staging and personal visibility overrides do not change definitions or other users',()=>{
  const defaults=[{id:'custom-one',name:' Shared ',visible:true},{id:'custom-two',name:'Later',visible:false}];
  const personal={hiddenDefaults:['custom-one'],custom:[{id:'custom-mine',name:'My kit',visible:true}]};
  assert.deepEqual(combineSections(defaults,personal).map(s=>s.visible),[false,false,true]);
  assert.deepEqual(combineSections(defaults,{}).map(s=>s.visible),[true,false]);
  assert.equal(defaults[0].visible,true);assert.equal(combineSections(defaults,personal)[0].name,'Shared');
  assert.equal(normalizeSections([{id:'__proto__'},...defaults,...defaults]).length,2);
  const widths={features:100,'custom-hidden':120,'custom-visible':180};
  assert.deepEqual(resizeSections(widths,['features','custom-visible'],'features',10.5),{features:110.5,'custom-hidden':120,'custom-visible':169.5});
});
test('activity choices honor native usability and sorting, and show their own uses',()=>{
  const a={id:'a',canUse:true,sort:20,uses:{max:3,spent:1}},b={id:'b',canUse:true,sort:5};
  assert.deepEqual(usableActivities({system:{activities:[a,{id:'rider',canUse:false,sort:0},b]}}),[b,a]);
  assert.equal(activityUses(a),'2/3');assert.equal(activityUses(b),'');
});
test('choosing an activity uses its native workflow without reopening item selection',async()=>{
  const bar=new CombatBar(),ctx={actor:{uuid:'Actor.test'},token:{uuid:'Token.test'}};let called=0;
  const event={shiftKey:false},activity={canUse:true,use:async options=>{called++;assert.equal(options.event,event);assert.equal(bar.usingActor,ctx.actor.uuid);return 'used';}};
  assert.equal(await bar.useActivity(ctx,activity,event),'used');assert.equal(called,1);assert.equal(bar.usingActor,null);
  activity.use=async()=>{throw Error('cancelled');};await assert.rejects(()=>bar.useActivity(ctx,activity,event),/cancelled/);assert.equal(bar.usingActor,null);
});
