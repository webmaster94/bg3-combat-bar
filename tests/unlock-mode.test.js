import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatBar} from '../scripts/bar.js';
import {defaultLayout} from '../scripts/model.js';
import {layout} from '../scripts/state.js';

function setup(locked){
  const flags={layout:{...defaultLayout(),locked}};
  const actor={uuid:'Actor.unlock',items:new Map([['potion',{id:'potion'}]]),isOwner:true,getFlag:(_s,k)=>flags[k],setFlag:async(_s,k,v)=>flags[k]=structuredClone(v)};
  const ctx={actor,document:actor,token:{uuid:'Token.unlock'}};
  const buttons=[{dataset:{slot:'items:0',item:''}},{dataset:{slot:'items:1',item:'potion'}}];
  for(const b of buttons)Object.assign(b,{classList:{toggle(){},remove(){}},setAttribute(){},removeAttribute(){}});
  const bar=new CombatBar(),calls={assign:0,use:0,menus:[]};
  bar.root={classList:{toggle(){}},querySelectorAll:s=>s==='[data-slot]'?buttons:[],querySelector:s=>buttons.find(b=>s===`[data-slot="${b.dataset.slot}"]`)??{}};
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
