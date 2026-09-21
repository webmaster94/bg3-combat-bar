import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultLayout,normalizeLayout} from '../scripts/model.js';
import {addGroup,groupsFor,expandGroups,removeSlots,planTransfer,applyTransfer,rowGeometry,ungroup} from '../scripts/groups.js';
import {sectionDefinitions,hideSection} from '../scripts/sections.js';
import {context,layout} from '../scripts/state.js';
import {BarEditor} from '../scripts/editor.js';
import {confirm} from '../scripts/dialogs.js';

const refs=(...indices)=>indices.map(index=>({section:'items',index}));
function document(uuid,flags={}){return {uuid,isOwner:true,getFlag:(_id,key)=>flags[key],setFlag:async(_id,key,value)=>flags[key]=structuredClone(value)};}

test('rectangular groups persist through layout normalization and expand from any member',()=>{
  const d=defaultLayout();d.pages[0].items[0]='potion';d.pages[0].items[13]='wand';
  addGroup(d,refs(0,1,12,13),'Battle kit','kit');
  assert.equal(groupsFor(normalizeLayout(d))[0].name,'Battle kit');
  assert.deepEqual(new Set(expandGroups(d,refs(13)).map(r=>r.index)),new Set([0,1,12,13]));
  assert.throws(()=>addGroup(d,refs(2,3,14),'Irregular','bad'),/rectangular/);
  assert.throws(()=>addGroup(d,[...refs(2),{section:'spells',index:2}],'Mixed','bad'),/one section/);
  ungroup(d,refs(0));assert.equal(d.groups.length,0);assert.equal(d.pages[0].items[0],'potion');
});

test('overlapping group drag moves every icon and title without row wrapping or loss',()=>{
  const d=defaultLayout();d.pages[0].items[0]='a';d.pages[0].items[1]='b';addGroup(d,refs(0,1),'Kit','kit');
  const p=planTransfer(d,refs(0),{anchor:refs(0)[0],destination:refs(1)[0]});
  assert.deepEqual(p.collisions,[]);applyTransfer(d,p);
  assert.deepEqual(d.pages[0].items.slice(0,3),[null,'a','b']);assert.deepEqual(d.groups[0].slots,[1,2]);
  assert.throws(()=>planTransfer(d,refs(1),{anchor:refs(1)[0],destination:refs(11)[0]}),/do not fit/);
});

test('Send To preserves relative positions, reports replacements, and leaves cancellation untouched',()=>{
  const d=defaultLayout();d.pages[0].items[13]='potion';d.pages[0].spells[25]='shield';d.pages[9].items[13]='wand';
  addGroup(d,refs(12,13),'Potions','kit');
  const before=structuredClone(d),p=planTransfer(d,[...refs(13),{section:'spells',index:25}],{page:9});
  assert.deepEqual(p.collisions,[{section:'items',index:13,itemId:'wand'}]);assert.deepEqual(d,before);
  applyTransfer(d,p);assert.equal(d.pages[9].items[13],'potion');assert.equal(d.pages[9].spells[25],'shield');
  assert.equal(d.pages[0].items[13],null);assert.equal(d.pages[0].spells[25],null);
  assert.deepEqual(d.groups[0],{id:'kit',page:9,section:'items',name:'Potions',slots:[12,13]});
});

test('replacing one icon inside a destination group preserves its other icons and title',()=>{
  const d=defaultLayout();d.page=1;d.pages[1].items[0]='old';d.pages[1].items[1]='keep';addGroup(d,refs(0,1),'Supplies','supplies');
  d.page=0;d.pages[0].items[0]='new';applyTransfer(d,planTransfer(d,refs(0),{page:1}));
  assert.deepEqual(d.pages[1].items.slice(0,2),['new','keep']);assert.equal(groupsFor(d,1)[0].name,'Supplies');
});

test('replacement confirmation requires the affirmative button; Cancel and close reject it',async()=>{
  let answer;
  globalThis.foundry={applications:{api:{DialogV2:{wait:async config=>{assert.ok(config.buttons.some(b=>b.action==='cancel'));return answer;}}}}};
  for(const result of [null,{button:'cancel'}]){answer=result;assert.equal(await confirm('Replace?','Items'),false);}
  answer={button:'yes'};assert.equal(await confirm('Replace?','Items'),true);delete globalThis.foundry;
});

test('cross-section moves reject collapsing a multi-selection into the same destination',()=>{
  const d=defaultLayout(['custom-kit']);d.pages[0].items[0]='potion';d.pages[0]['custom-kit'][0]='wand';
  assert.throws(()=>planTransfer(d,[...refs(0),{section:'custom-kit',index:0}],{anchor:refs(0)[0],destination:{section:'custom-kit',index:1}}),/overlap/);
  assert.equal(d.pages[0].items[0],'potion');
});

test('lower-row headings reserve space without changing slot indices or other rows',()=>{
  const d=defaultLayout();addGroup(d,refs(12,13),'Lower','lower');
  let geometry=rowGeometry(groupsFor(d),2);
  assert.equal(geometry.slotTop(0),0);assert.equal(geometry.titleTop(1),44);assert.equal(geometry.slotTop(1),64);assert.equal(geometry.height,106);
  addGroup(d,refs(0,1),'Upper','upper');geometry=rowGeometry(groupsFor(d),2);
  assert.equal(geometry.slotTop(0),20);assert.equal(geometry.slotTop(1),84);assert.equal(geometry.height,126);
  addGroup(d,refs(14,15),'Other lower','other');assert.equal(rowGeometry(groupsFor(d),2).height,126);
});

test('removal includes the complete selected group but keeps other pages and assignments',()=>{
  const d=defaultLayout();d.pages[0].items[0]='a';d.pages[0].items[1]='b';d.pages[0].items[2]='c';d.pages[1].items[0]='a';addGroup(d,refs(0,1),'Kit','kit');
  removeSlots(d,refs(1));assert.deepEqual(d.pages[0].items.slice(0,3),[null,null,'c']);assert.equal(d.pages[1].items[0],'a');assert.deepEqual(d.groups,[]);
});

test('character definitions share linked actors and stay independent on unlinked tokens',async()=>{
  globalThis.foundry={utils:{deepClone:structuredClone}};
  globalThis.game={settings:{get:()=>[{id:'custom-global',name:'Global',visible:true}]},user:{getFlag:()=>({custom:[{id:'custom-personal',name:'My global',visible:true}]})}};
  const actor=document('Actor.a',{characterSections:{custom:[{id:'custom-actor',name:'Actor kit',visible:true}]}});
  const linked=context({actor,actorLink:true}),linked2=context({actor,actorLink:true});
  const token=document('Token.one',{characterSections:{custom:[{id:'custom-token',name:'Token kit',visible:true}]}});Object.assign(token,{actor,actorLink:false});
  const unlinked=context(token),other=context(Object.assign(document('Token.two'),{actor,actorLink:false}));
  assert.deepEqual(sectionDefinitions(linked),sectionDefinitions(linked2));
  assert.deepEqual(sectionDefinitions(unlinked).map(s=>s.id),['custom-global','custom-personal','custom-token']);
  assert.equal(sectionDefinitions(other).length,2);assert.ok(layout(unlinked).pages[0]['custom-token']);assert.equal(layout(other).pages[0]['custom-token'],undefined);
  await hideSection('custom-global',unlinked);assert.equal(sectionDefinitions(unlinked)[0].visible,false);assert.equal(sectionDefinitions(linked)[0].visible,true);
  await hideSection('custom-actor',linked);assert.equal(sectionDefinitions(linked2)[2].visible,false);
  delete globalThis.game;delete globalThis.foundry;
});

test('locked drag-off removes a whole group on its captured character and page, never sheet items',async()=>{
  const d=defaultLayout();d.locked=true;d.pages[0].items[0]='a';d.pages[0].items[1]='b';addGroup(d,refs(0,1),'Kit','kit');
  const actor=document('Actor.drag',{layout:d}),ctx={actor,document:actor};let deleted=0;actor.deleteEmbeddedDocuments=()=>deleted++;
  const editor=new BarEditor({schedule(){}});await editor.removeDragged({ctx,page:0,refs:refs(1),weapon:false});
  assert.deepEqual(layout(ctx).pages[0].items.slice(0,2),[null,null]);assert.equal(deleted,0);
});

test('canceling a native drag never removes slots; a confirmed off-bar drop does',async()=>{
  const d=defaultLayout();d.pages[0].items[0]='a';
  const actor=document('Actor.drag-cancel',{layout:d});actor.items=new Map([['a',{id:'a',uuid:'Actor.drag-cancel.Item.a'}]]);
  const ctx={actor,document:actor},listeners=new Map();
  globalThis.document={addEventListener:(type,fn)=>listeners.set(type,fn)};
  const editor=new BarEditor({schedule(){},hideTooltip(){},activities:{close(){}},root:{contains:()=>false}});
  const button={dataset:{slot:'items:0',item:'a'}},event={dataTransfer:{setData(){}}};
  editor.startDrag(ctx,button,event);button.ondragend();assert.equal(layout(ctx).pages[0].items[0],'a');
  editor.startDrag(ctx,button,event);let removal;const original=editor.removeDragged.bind(editor);editor.removeDragged=d=>removal=original(d);
  listeners.get('drop')({preventDefault(){},stopPropagation(){},target:{}});await removal;
  assert.equal(layout(ctx).pages[0].items[0],null);delete globalThis.document;
});
