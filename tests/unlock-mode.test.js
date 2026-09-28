import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatBar} from '../scripts/bar.js';
import {defaultLayout} from '../scripts/model.js';
import {layout,editLayout} from '../scripts/state.js';
import {addGroup,groupsFor} from '../scripts/groups.js';

function setup(locked){
  const flags={layout:{...defaultLayout(),locked}};
  const actor={uuid:'Actor.unlock',items:new Map([['potion',{id:'potion',name:'Potion',type:'consumable',system:{quantity:3}}]]),isOwner:true,getFlag:(_s,k)=>flags[k],setFlag:async(_s,k,v)=>flags[k]=structuredClone(v)};
  const ctx={actor,document:actor,token:{uuid:'Token.unlock'}};
  const buttons=[{dataset:{slot:'items:0',item:''}},{dataset:{slot:'items:1',item:'potion'}}];
  for(const b of buttons)Object.assign(b,{classList:{toggle(){},remove(){}},setAttribute(){},removeAttribute(){}});
  const targets=new Map();
  const bar=new CombatBar(),calls={assign:0,use:0,menus:[]};
  bar.root={classList:{toggle(){}},querySelectorAll:s=>s==='[data-slot]'?buttons:[],querySelector:s=>{const button=buttons.find(b=>s===`[data-slot="${b.dataset.slot}"]`);if(button)return button;if(!targets.has(s))targets.set(s,{});return targets.get(s);}};
  bar.assign=async()=>{calls.assign++;};bar.useItem=async()=>{calls.use++;};bar.hover=()=>{};bar.schedule=()=>{};
  bar.editor.menuAt=(_ctx,ref)=>calls.menus.push(ref);
  const bind=()=>{const d=layout(ctx);bar.editor.sync(ctx,d);bar.bind(ctx,d);};
  return {ctx,bar,calls,buttons,bind};
}
const event=()=>({preventDefault(){},stopPropagation(){}});

test('unlocking directly selects empty and occupied slots and opens the selection context menu',async()=>{
  const h=setup(true);h.bind();
  await h.bar.command('lock',h.ctx,layout(h.ctx));h.bind();
  await h.buttons[0].onclick(event());await h.buttons[1].onclick(event());
  await h.buttons[1].oncontextmenu(event());
  assert.equal(h.calls.assign,0,'Unlocked slot clicks must select instead of opening a picker');
  assert.equal(h.calls.use,0,'Selecting an assigned slot must not use the item');
  assert.deepEqual(h.bar.editor.selected,[{section:'items',index:0},{section:'items',index:1}]);
  assert.deepEqual(h.calls.menus,[{section:'items',index:1}]);
});

test('an already-unlocked character selects immediately after loading or switching context',async()=>{
  const h=setup(false);h.bar.editor.reset();h.bind();
  await h.buttons[0].onclick(event());
  assert.equal(h.calls.assign,0);assert.equal(h.bar.editor.selected.length,1);
  h.bind();assert.equal(h.bar.editor.selected.length,1,'Meaningful redraws preserve selection');
  await h.buttons[0].oncontextmenu(event());assert.equal(h.calls.menus.length,1);
});

test('Assign Item in the selection menu opens the picker for the clicked slot',async()=>{
  const h=setup(false);h.bind();
  let target;h.bar.assign=async(ctx,button)=>{assert.equal(ctx,h.ctx);target=button;};
  await h.buttons[0].onclick(event());await h.buttons[1].onclick(event());
  await h.bar.editor.command(h.ctx,'assign',h.bar.editor.selected,{section:'items',index:1});
  assert.equal(target,h.buttons[1]);assert.equal(h.bar.editor.selected.length,2);
});

test('both Finish Editing controls lock the bar, clear selection, and restore item use',async()=>{
  for(const fromMenu of [false,true]){
    const h=setup(false);h.bind();await h.buttons[0].onclick(event());
    if(fromMenu)await h.bar.editor.command(h.ctx,'done',h.bar.editor.selected);
    else await h.bar.command('finishEditing',h.ctx,layout(h.ctx));
    h.bind();assert.equal(layout(h.ctx).locked,true);assert.equal(h.bar.editor.active,false);assert.deepEqual(h.bar.editor.selected,[]);
    await h.buttons[1].onclick(event());assert.equal(h.calls.use,1);
    await h.bar.command('lock',h.ctx,layout(h.ctx));h.bind();
    await h.buttons[0].onclick(event());assert.equal(h.calls.assign,0);assert.equal(h.bar.editor.selected.length,1);
  }
});


test('Play mode uses occupied slots, assigns empty slots, and keeps right-click replacement without multi-select',async()=>{
  const h=setup(true);h.bind();
  await h.buttons[0].onclick(event());await h.buttons[1].onclick(event());await h.buttons[1].oncontextmenu(event());
  assert.equal(h.calls.assign,2);assert.equal(h.calls.use,1);assert.deepEqual(h.calls.menus,[]);assert.deepEqual(h.bar.editor.selected,[]);
  h.bar.editor.toggle(h.ctx,{section:'items',index:0});assert.deepEqual(h.bar.editor.selected,[]);
});

test('Play mode writes, swaps, and clears assignments while preserving inventory and group definitions',async()=>{
  const h=setup(true),assign=CombatBar.prototype.assignItem.bind(h.bar);
  await assign(h.ctx,h.buttons[0],'potion');assert.equal(layout(h.ctx).pages[0].items[0],'potion');
  await editLayout(h.ctx,d=>addGroup(d,[{section:'items',index:1}], 'Supplies','supplies'));
  await assign(h.ctx,h.buttons[1],'potion',{owner:h.ctx.document.uuid,page:0,slot:'items:0'});
  assert.equal(layout(h.ctx).pages[0].items[0],null);assert.equal(layout(h.ctx).pages[0].items[1],'potion');
  await assign(h.ctx,{dataset:{assign:'items:1'}},null);
  assert.equal(layout(h.ctx).pages[0].items[1],null);assert.equal(groupsFor(layout(h.ctx))[0].name,'Supplies');
  assert.equal(h.ctx.actor.items.get('potion').system.quantity,3);
});

test('Play mode moves an entire group through the real drop path but refuses to dismantle another group',async()=>{
  const h=setup(true);h.bind();
  await editLayout(h.ctx,d=>{d.pages[0].items[0]='potion';addGroup(d,[{section:'items',index:0},{section:'items',index:1}],'Potions','potions');});
  h.bar.editor.drag={ctx:h.ctx,page:0,weapon:false,refs:[{section:'items',index:0},{section:'items',index:1}],anchor:{section:'items',index:0}};
  assert.equal(await h.bar.editor.drop(h.ctx,{dataset:{slot:'items:12'}},event()),true);
  assert.equal(layout(h.ctx).pages[0].items[12],'potion');assert.deepEqual(groupsFor(layout(h.ctx))[0].slots,[12,13]);
  await editLayout(h.ctx,d=>addGroup(d,[{section:'items',index:24},{section:'items',index:25}],'Other','other'));
  const before=layout(h.ctx);
  await assert.rejects(()=>h.bar.editor.transfer(h.ctx,[{section:'items',index:12}],{anchor:{section:'items',index:12},destination:{section:'items',index:24}}),/Build mode/);
  assert.deepEqual(layout(h.ctx),before);
  await h.bar.editor.command(h.ctx,'ungroup',[{section:'items',index:12}]);assert.equal(groupsFor(layout(h.ctx)).length,2);
});

test('Play mode has no extra removal control on assigned slots',()=>{
  const h=setup(true);const html=h.bar.slot(h.ctx,'potion',{section:'items',index:1,locked:true});
  assert.doesNotMatch(html,/data-clear-slot|bg3-clear-slot/);
});


test('Play mode adds and removes custom resource counters through the real resource dialogs',async t=>{
  const h=setup(true),original=globalThis.foundry;t.after(()=>{if(original===undefined)delete globalThis.foundry;else globalThis.foundry=original;});
  const responses=[{button:'custom'},{button:'save',data:new Map([['name','Focus'],['value','2'],['max','4'],['reset','short']])},{button:'remove'}],titles=[];
  globalThis.foundry={applications:{api:{DialogV2:{wait:async options=>{titles.push(options.window.title);return responses.shift();}}}}};
  await h.bar.addResource(h.ctx);assert.equal(layout(h.ctx).resources[0].name,'Focus');
  await h.bar.configureResource(h.ctx,0);assert.deepEqual(layout(h.ctx).resources,[]);
  assert.deepEqual(titles,['Add Resource','Custom Counter','Custom Counter']);assert.equal(layout(h.ctx).locked,true);
});

test('Play mode accepts sheet-item slot and resource drops and avoids duplicate tracking',async t=>{
  const h=setup(true),original=globalThis.fromUuid;t.after(()=>{if(original===undefined)delete globalThis.fromUuid;else globalThis.fromUuid=original;});
  const item=h.ctx.actor.items.get('potion');item.actor=h.ctx.actor;globalThis.fromUuid=async()=>item;h.bind();
  const resourceDrop=h.bar.root.querySelector('[data-resource-drop]'),drop={...event(),dataTransfer:{getData:()=>JSON.stringify({type:'Item',uuid:'Actor.unlock.Item.potion'})}};
  let accepted=false;resourceDrop.ondragover({preventDefault(){accepted=true;}});assert.equal(accepted,true);
  await resourceDrop.ondrop(drop);await resourceDrop.ondrop(drop);
  assert.deepEqual(layout(h.ctx).resources,[{itemId:'potion'}]);assert.equal(item.system.quantity,3);
  await h.buttons[0].ondrop(drop);assert.equal(layout(h.ctx).pages[0].items[0],'potion');
});
