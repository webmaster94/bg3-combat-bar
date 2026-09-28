import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultLayout,normalizeLayout,resizeSections,MAX_SECTION_WIDTH} from '../scripts/model.js';
import {CombatBar} from '../scripts/bar.js';
import {layout} from '../scripts/state.js';

test('collapsed widths survive normalization without losing pages, groups, order, or resources',()=>{
  const d=defaultLayout(['custom-kit']);d.pages[9]['custom-kit'][71]='kept';d.pages[0].features[0]='rage';
  d.groups=[{id:'kit',page:9,section:'custom-kit',name:'Kit',slots:[70,71]}];d.resources=[{itemId:'rage'}];
  for(const key of Object.keys(d.widths))d.widths[key]=0;
  assert.deepEqual(normalizeLayout(d),d);
  assert.equal(normalizeLayout({version:3,widths:{features:null,items:-4}}).widths.features,262);
});

test('dragging can fully collapse a section even when its neighbor cannot take more space',()=>{
  const widths={features:100,spells:MAX_SECTION_WIDTH,items:0};
  const next=resizeSections(widths,['features','spells','items'],'features',-500);
  assert.deepEqual(next,{features:0,spells:MAX_SECTION_WIDTH,items:0});
  assert.deepEqual(resizeSections(next,['features','spells','items'],'features',16.5),{features:16.5,spells:509.5,items:0});
  assert.equal(resizeSections(next,['features','spells','items'],'items',1000).items,MAX_SECTION_WIDTH);
});

test('resizing an open grid does not reopen a collapsed neighboring section',()=>{
  const order=['features','spells','items'];
  assert.deepEqual(resizeSections({features:100,spells:0,items:150},order,'features',-25),{features:75,spells:0,items:175});
  assert.deepEqual(resizeSections({features:40,spells:0,items:0},order,'features',-40),{features:0,spells:0,items:0});
});

test('all sections can be collapsed and expanded in Play without redistributing saved neighbors',async()=>{
  let saved={...defaultLayout(['custom-kit']),locked:true};
  const ctx={document:{uuid:'Actor.collapse',getFlag:(_s,key)=>key==='layout'?saved:null,setFlag:async(_s,_k,value)=>saved=value}};
  const bar=new CombatBar(),original=structuredClone(saved);
  for(const key of Object.keys(saved.widths))await bar.setSectionWidth(ctx,key,0);
  assert.ok(Object.values(layout(ctx).widths).every(w=>w===0));
  await bar.setSectionWidth(ctx,'custom-kit',MAX_SECTION_WIDTH);
  assert.equal(saved.widths['custom-kit'],526);assert.equal(saved.widths.items,0);
  assert.deepEqual(saved.pages,original.pages);assert.deepEqual(saved.weapons,original.weapons);
});

test('mouse collapse requires a double-click while expand needs one click',async()=>{
  let saved=defaultLayout();const ctx={actor:{items:new Map()},document:{uuid:'Actor.clicks',getFlag:(_s,k)=>k==='layout'?saved:null,setFlag:async(_s,_k,value)=>saved=value}};
  const collapse={dataset:{collapseSection:'items'}},expand={dataset:{expandSection:'items'}},nodes=new Map();
  const bar=new CombatBar();bar.root={querySelectorAll:s=>s==='[data-collapse-section]'?[collapse]:s==='[data-expand-section]'?[expand]:[],querySelector:s=>{if(!nodes.has(s))nodes.set(s,{});return nodes.get(s);}};
  bar.bind(ctx,saved);const event={detail:1,preventDefault(){},stopPropagation(){}};
  await collapse.onclick(event);assert.equal(saved.widths.items,174);
  await collapse.ondblclick({...event,detail:2});assert.equal(saved.widths.items,0);
  await expand.onclick(event);assert.equal(saved.widths.items,526);
  await collapse.onclick({...event,detail:0});assert.equal(saved.widths.items,0,'Keyboard activation remains accessible');
});
