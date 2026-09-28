import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatBar} from '../scripts/bar.js';
import {defaultLayout} from '../scripts/model.js';
import {layout} from '../scripts/state.js';

test('Play mode divider keyboard adjustment resizes adjacent visible sections',async()=>{
  let saved={...defaultLayout(),locked:true};
  const ctx={document:{uuid:'Actor.resize',getFlag:(_s,key)=>key==='layout'?saved:null,setFlag:async(_s,_k,value)=>saved=value}};
  const bar=new CombatBar(),handle={dataset:{resize:'features'}};
  bar.bindResize(handle,ctx,layout(ctx),fn=>fn);
  await handle.onkeydown({key:'ArrowRight',preventDefault(){},stopPropagation(){}});
  assert.equal(saved.widths.features,270);assert.equal(saved.widths.spells,254);
});
