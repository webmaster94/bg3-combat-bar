import test from 'node:test';
import assert from 'node:assert/strict';
import {itemState,useDisplay} from '../scripts/item-state.js';
import {pickerEntries} from '../scripts/picker.js';
const activity=(extra={})=>({canUse:true,activation:{type:'action'},consumption:{targets:[]},...extra});
const item=(type,system={})=>({id:'test',name:'Test',type,system:{activities:[activity()],...system}});
test('infinity excludes slot, resource, quantity, and mixed-activity restrictions',()=>{
  assert.equal(useDisplay(item('feat')),'∞');
  assert.equal(useDisplay(item('spell',{level:0})),'∞');
  assert.equal(useDisplay(item('spell',{level:2,method:'atwill'})),'∞');
  assert.equal(useDisplay(item('spell',{level:1,method:'spell'})),'');
  const charged=activity({consumption:{targets:[{type:'itemUses',target:'ki',value:'1'}]}});
  const feature=item('feat',{activities:[activity(),charged]});
  assert.equal(useDisplay(feature),'');assert.equal(useDisplay(feature,feature.system.activities[0]),'∞');assert.equal(useDisplay(feature,charged),'');
  assert.equal(useDisplay(item('consumable',{quantity:3})),'');
  assert.equal(useDisplay(item('feat',{uses:{max:3,spent:2}})),'1/3');
});
test('spell availability considers higher-level and pact slots independently of upcast effects',()=>{
  const spell=item('spell',{level:1,method:'spell',prepared:1});
  const actor={system:{spells:{spell1:{value:0},spell2:{value:1}}}};
  assert.equal(itemState(spell,null,actor).unavailable,false);
  actor.system.spells.spell2.value=0;assert.equal(itemState(spell,null,actor).unavailable,true);
  actor.system.spells.pact={level:2,value:1};assert.equal(itemState(spell,null,actor).unavailable,false);
  spell.system.prepared=0;assert.deepEqual(itemState(spell,null,actor).reasons,['Not prepared']);
  spell.system.method='atwill';assert.equal(itemState(spell,null,actor).unavailable,false);
});
test('unattuned and exhausted activities do not disable another available activity',()=>{
  const magic=activity({canUse:false,visibility:{requireAttunement:true}}),free=activity();
  const i=item('equipment',{attunement:'required',attuned:false,activities:[magic,free]});
  assert.equal(itemState(i).unavailable,false);assert.deepEqual(itemState(i,magic).reasons,['Not attuned']);
  i.system.activities=[magic];assert.equal(itemState(i).unavailable,true);
  const uses=activity({uses:{max:2,spent:2}});i.system.activities=[uses,free];assert.equal(itemState(i).unavailable,false);assert.equal(itemState(i,uses).unavailable,true);
});
test('quantity and per-item uses are separate; linked resource exhaustion is reported',()=>{
  const potion=item('consumable',{quantity:4,uses:{max:1,spent:0},activities:[activity({consumption:{targets:[{type:'itemUses',value:'1'}]}})]});
  assert.equal(itemState(potion).badge,'1/1');assert.equal(itemState(potion).quantity,'4');assert.equal(itemState(potion).unavailable,false);
  potion.system.quantity=0;assert.ok(itemState(potion).reasons.includes('No quantity remaining'));
  const pool=item('feat',{uses:{max:3,spent:3}}),feature=item('feat',{activities:[activity({consumption:{targets:[{type:'itemUses',target:'ki',value:'1'}]}})]});
  assert.equal(itemState(feature,null,{items:new Map([['ki',pool]])}).unavailable,true);
});
test('a spell granted by an item checks the granting resource instead of actor slots',()=>{
  const wand=item('equipment',{uses:{max:3,spent:0}});
  const linked=activity({item:wand,consumption:{targets:[{type:'itemUses',value:'1'}]}});
  const spell=item('spell',{level:1,method:'spell',prepared:1,linkedActivity:linked});
  assert.equal(useDisplay(spell),'');assert.equal(itemState(spell,null,{system:{spells:{}}}).unavailable,false);
  wand.system.uses.spent=3;assert.ok(itemState(spell).reasons.includes('No uses remaining'));
});
test('inventory groups honor existing Tidy section names without a Tidy dependency',()=>{
  const i=item('equipment');i.flags={'tidy5e-sheet':{section:'Adjudicator'}};
  assert.equal(pickerEntries([i],{category:'items'})[0][0],'Adjudicator');
});
test('unified picker combines activation alternatives, groups spell levels, and filters availability',()=>{
  const a=item('spell',{level:2,method:'atwill'});a.name='Second';
  const b=item('spell',{level:0,activities:[activity({activation:{type:'bonus'}})]});b.name='Cantrip';
  const c=item('spell',{level:1,method:'spell',prepared:0});
  assert.deepEqual(pickerEntries([a,b,c],{category:'spells',filters:['action','bonus','available']}).map(([name])=>name),['Cantrips','Level 2']);
  assert.equal(pickerEntries([a,b],{category:'spells',query:'second'})[0][1][0],a);
  assert.equal(pickerEntries([a,b],{category:'items'}).length,0);
});
