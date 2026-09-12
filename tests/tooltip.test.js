import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatBar} from '../scripts/bar.js';

test('moving directly between slots replaces the tooltip without leaving the bar', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const element = () => ({
    isConnected:true, style:{}, innerHTML:'',
    setAttribute(){}, remove(){this.isConnected=false;},
    getBoundingClientRect(){return {left:200,top:500,width:200,height:100};}
  });
  const originals = Object.fromEntries(['document','innerWidth','innerHeight'].map(k=>[k,globalThis[k]]));
  globalThis.document={createElement:element,body:{append(){}}};
  globalThis.innerWidth=1200;globalThis.innerHeight=800;
  t.after(()=>{for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
  const bar=new CombatBar(),first=element(),second=element(),third=element();
  bar.hover(first,async()=> 'First item');
  bar.hover(second,async()=> 'Second item');
  bar.hover(third,async()=> 'Third item');
  first.onmouseenter();t.mock.timers.tick(250);await Promise.resolve();
  assert.equal(bar.tooltip?.innerHTML,'First item');
  first.onmouseleave();second.onmouseenter();
  t.mock.timers.tick(180);await Promise.resolve();
  t.mock.timers.tick(70);await Promise.resolve();
  assert.equal(bar.tooltip?.innerHTML,'Second item');
  second.onmouseleave();third.onmouseenter();
  t.mock.timers.tick(250);await Promise.resolve();
  assert.equal(bar.tooltip?.innerHTML,'Third item');
  third.onmouseleave();t.mock.timers.tick(250);await Promise.resolve();
  assert.equal(bar.tooltip,null);
  // A description that finishes after leaving its slot must not reopen the old tooltip.
  let resolveDescription;
  bar.hover(first,()=>new Promise(resolve=>{resolveDescription=resolve;}));
  first.onmouseenter();t.mock.timers.tick(250);await Promise.resolve();
  first.onmouseleave();second.onmouseenter();
  resolveDescription('Stale first item');await Promise.resolve();
  assert.equal(bar.tooltip,null);
  t.mock.timers.tick(250);await Promise.resolve();
  assert.equal(bar.tooltip?.innerHTML,'Second item');
});
