import test from 'node:test';import assert from 'node:assert/strict';
import {defaultLayout,normalizeLayout,resizeSections,newPage,matchesItem,usesBadge,spendEconomy,freshEconomy,sizeAllowed,turnKey} from '../scripts/model.js';
import {storage,editLayout} from '../scripts/state.js';
test('four independent full loadouts and per-page slots survive normalization',()=>{const d=defaultLayout();d.weapons.ranged[1][1]='crossbow';d.pages.push(newPage());d.pages[1].spells[4]='magic';d.page=1;const n=normalizeLayout(d);assert.equal(n.weapons.ranged[1][1],'crossbow');assert.equal(n.weapons.melee[1][1],null);assert.equal(n.pages[1].spells[4],'magic');assert.equal(n.pages[0].spells[4],null);n.pages[1].spells[4]='other';assert.equal(d.pages[1].spells[4],'magic');});
test('corrupt page index and missing sections recover',()=>{const d=normalizeLayout({version:1,pages:[{}],page:500,order:['spells','spells','bad']});assert.equal(d.page,9);assert.equal(d.pages.length,10);assert.equal(d.pages[0].features.length,72);assert.deepEqual(d.order,['spells','weapons','features','items']);});
test('typed item filtering keeps ranged and melee separate and permits offhand shields',()=>{const spear={type:'weapon',system:{type:{value:'simpleM'},properties:new Set(['thr'])}};assert.equal(matchesItem(spear,'ranged'),false);assert.equal(matchesItem(spear,'melee'),true);assert.equal(matchesItem({type:'weapon',system:{type:{value:'martialR'}}},'ranged'),true);assert.equal(matchesItem({type:'equipment',system:{type:{value:'shield'}}},'melee',1),true);assert.equal(matchesItem({type:'spell'},'features'),false);assert.equal(matchesItem({type:'feat'},'items'),false);});
test('remaining uses exclude spell slots and handle spent-use schema',()=>{assert.equal(usesBadge({type:'spell',system:{level:3,uses:{max:''}}}), '');assert.equal(usesBadge({system:{uses:{max:3,spent:2}}}),'1/3');assert.equal(usesBadge({type:'consumable',system:{quantity:4}}),'4');});
test('Attack action grants extra attacks, separate action cannot spend it twice',()=>{const fresh=freshEconomy('turn');const one=spendEconomy(fresh,'attack',2);assert.equal(one.action,0);assert.equal(one.attacks,1);assert.equal(spendEconomy(one,'action'),null);const two=spendEconomy(one,'attack',2);assert.equal(two.attacks,0);assert.equal(spendEconomy(two,'attack',2),null);assert.equal(spendEconomy(two,'bonus').bonus,0);assert.equal(fresh.action,1);});
test('turn identity resets at next turn and across different combats',()=>{assert.notEqual(turnKey({id:'A',started:true,round:1,turn:0}),turnKey({id:'B',started:true,round:1,turn:0}));assert.equal(turnKey(null),'outside');assert.equal(sizeAllowed('med','huge'),false);assert.equal(sizeAllowed('sm','med'),true);});
test('linked actors share layout while unlinked tokens keep separate flags',()=>{const actor={id:'a'},one={actorLink:false},two={actorLink:false};assert.equal(storage(actor,{actorLink:true}),actor);assert.equal(storage(actor,one),one);assert.notEqual(storage(actor,one),storage(actor,two));});
test('concurrent edits serialize without losing either slot assignment',async()=>{let saved;const document={uuid:'Actor.test',getFlag:()=>saved,setFlag:async(_s,_k,value)=>{await new Promise(r=>setTimeout(r,5));saved=value;}};await Promise.all([editLayout({document},d=>{d.pages[0].features[0]='rage';}),editLayout({document},d=>{d.pages[0].spells[0]='shield';})]);assert.equal(saved.pages[0].features[0],'rage');assert.equal(saved.pages[0].spells[0],'shield');});

test('legacy assignments keep their row and column when migrated to ten pages',()=>{
  const legacy={version:1,pages:[{features:['first',null,null,null,null,'edge','second row']}],widths:{features:8}};
  const d=normalizeLayout(legacy);
  assert.equal(d.version,2);assert.equal(d.pages.length,10);assert.equal(d.rows,2);
  assert.equal(d.widths.features,174);assert.equal(d.pages[0].features[0],'first');
  assert.equal(d.pages[0].features[5],'edge');assert.equal(d.pages[0].features[12],'second row');
  assert.equal(d.pages[0].features[6],null);assert.deepEqual(normalizeLayout(d),d);
});
test('section divider preserves fractional widths, neighboring total, and hidden assignments',()=>{
  const d=defaultLayout();d.pages[0].features[10]='hidden';d.pages[0].features[24]='third row';
  const widths=resizeSections(d.widths,d.order,'features',19.25);
  assert.equal(widths.features,281.25);assert.equal(widths.spells,242.75);
  const n=normalizeLayout({...d,widths,rows:3});
  assert.equal(n.widths.features,281.25);assert.equal(n.pages[0].features[10],'hidden');
  assert.equal(n.pages[0].features[24],'third row');assert.equal(n.rows,3);
  const limited=resizeSections(d.widths,d.order,'features',10000);
  assert.equal(limited.spells,42);assert.equal(limited.features+limited.spells,524);
});
