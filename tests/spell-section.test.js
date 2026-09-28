import test from 'node:test';
import assert from 'node:assert/strict';
import {hasSpellcasting,visibleSectionOrder} from '../scripts/sections.js';
import {defaultLayout,normalizeLayout} from '../scripts/model.js';

const actor=(system={},items=[])=>({system,items});
test('noncasters and resource-only feats do not show the spell section',()=>{
  const a=actor({attributes:{spellcasting:'int'},spells:{spell1:{max:0,value:0}}},[{type:'feat',name:'Metamagic Adept',system:{uses:{max:2},activities:[]}}]);
  assert.equal(hasSpellcasting(a),false);
  assert.deepEqual(visibleSectionOrder(defaultLayout(),{actor:a}),['features','items']);
});
test('spellcasting remains visible when slots are spent or no spells are prepared',()=>{
  for(const a of [actor({spells:{spell1:{max:3,value:0}}}),{...actor(),spellcastingClasses:{wizard:{}}},actor({},[{type:'spell',system:{level:0,prepared:0}}])])assert.equal(hasSpellcasting(a),true);
});
test('an item or feature with a linked Cast spell shows spells even without class spellcasting',()=>{
  for(const type of ['equipment','feat','consumable']){
    const a=actor({},[{type,system:{uses:{max:2,spent:2},activities:[{type:'cast',canUse:false,spell:{uuid:'Compendium.test.Item.spell',spellbook:false}}]}}]);
    assert.equal(hasSpellcasting(a),true);assert.ok(visibleSectionOrder(defaultLayout(),{actor:a}).includes('spells'));
  }
  assert.equal(hasSpellcasting(actor({},[{type:'feat',system:{activities:[{type:'cast',spell:{uuid:''}}]}}])),false);
});
test('hiding and restoring the spell section preserves page assignments, groups, order, and width',()=>{
  const data=defaultLayout(),a=actor();data.pages[9].spells[25]='saved-spell';data.widths.spells=187.5;
  data.groups=[{id:'magic',section:'spells',page:9,name:'Magic',slots:[25]}];const before=structuredClone(data);
  assert.equal(visibleSectionOrder(data,{actor:a}).includes('spells'),false);
  a.items.push({type:'spell'});assert.equal(visibleSectionOrder(data,{actor:a}).includes('spells'),true);
  assert.deepEqual(normalizeLayout(data),before);
});
