import test from 'node:test';
import assert from 'node:assert/strict';
import {effectSettings} from '../scripts/effects.js';
import {effectGrid,collectEffects,canEditEffect,effectExpired} from '../scripts/effect-model.js';
const modes={NEVER:0,ALWAYS:2};
const effect=(uuid,data={})=>({uuid,isTemporary:true,showIcon:1,isOwner:true,...data});

test('v13 effects without icon visibility constants still respect passive and disabled filters',()=>{
  const active=effect('active',{showIcon:undefined}),passive=effect('passive',{showIcon:undefined,isTemporary:false}),disabled=effect('disabled',{showIcon:undefined,disabled:true});
  const actor={allApplicableEffects:()=>[active,passive,disabled],items:[]};
  assert.deepEqual(collectEffects(actor,{hidePassive:true,hideDisabled:true}).map(e=>e.effect.uuid),['active']);
  assert.equal(collectEffects(actor,{hidePassive:false,hideDisabled:false}).length,3);
});

test('v13 expired durations use remaining time while v14 keeps its native expiration result',()=>{
  assert.equal(effectExpired({isTemporary:true,duration:{remaining:-1}}),true);
  assert.equal(effectExpired({isTemporary:true,duration:{remaining:0}}),true);
  assert.equal(effectExpired({isTemporary:true,duration:{remaining:3}}),false);
  assert.equal(effectExpired({isTemporary:false,duration:{remaining:null}}),false);
  assert.equal(effectExpired({isTemporary:true,duration:{remaining:Infinity}}),false);
  assert.equal(effectExpired({isTemporary:true,duration:{remaining:0,expired:false}}),false);
});
test('effect icons fill two complete rows before widening and keep every icon',()=>{
  // Four 50px icons and three 4px gaps fit in the initial lane.
  assert.deepEqual(effectGrid(4,212,50),{columns:4,rows:1,width:212,expansion:0});
  assert.deepEqual(effectGrid(5,212,50),{columns:4,rows:2,width:212,expansion:0});
  assert.equal(effectGrid(8,212,50).expansion,0);
  const ninth=effectGrid(9,212,50);
  assert.equal(ninth.columns,5);assert.equal(ninth.rows,2);assert.equal(ninth.expansion,108);
  assert.ok(ninth.columns*ninth.rows>=9);
  assert.equal(ninth.width,212+ninth.expansion/2);
  assert.equal(effectGrid(3,212,50).expansion,0);
  assert.equal(effectGrid(0,212,50).rows,0);
});
test('effect filtering honors explicit icon visibility, suppression, grouping, and item deduplication',()=>{
  const active=effect('active'),passive=effect('passive',{isTemporary:false}),disabled=effect('disabled',{disabled:true}),always=effect('always',{showIcon:2,isTemporary:false,disabled:true});
  const actor={allApplicableEffects:()=>[active,passive,disabled,always,effect('hidden',{showIcon:0}),effect('suppressed',{showIcon:2,isSuppressed:true})],items:[{allApplicableEffects:()=>[active,effect('enchantment')]}]};
  assert.deepEqual(collectEffects(actor,{hidePassive:true,hideDisabled:true},modes).map(e=>e.effect.uuid),['active','always','enchantment']);
  assert.deepEqual(collectEffects(actor,{hidePassive:false,hideDisabled:false},modes).map(e=>e.effect.uuid),['active','passive','disabled','always','enchantment']);
});
test('effect controls honor ownership and the GM player-interaction setting',()=>{
  assert.equal(canEditEffect(effect('e'),{playerClicks:false},{isGM:false}),false);
  assert.equal(canEditEffect(effect('e'),{playerClicks:true},{isGM:false}),true);
  assert.equal(canEditEffect(effect('e'),{playerClicks:false},{isGM:true}),true);
  assert.equal(canEditEffect(effect('e',{isOwner:false}),{playerClicks:true},{isGM:false}),false);
});

test('effect settings work standalone and inherit installed VAE preferences',()=>{
  const values=new Map([['bg3-combat-bar.effects.iconSize',42],['visual-active-effects.iconSize',68]]);
  globalThis.game={modules:new Map(),settings:{settings:new Map([['visual-active-effects.iconSize',{}]]),get:(scope,key)=>values.get(`${scope}.${key}`)}};
  assert.equal(effectSettings().iconSize,21);
  game.modules.set('visual-active-effects',{active:true});
  assert.equal(effectSettings().iconSize,34);
  assert.equal(effectSettings().hidePassive,true);
  game.modules.get('visual-active-effects').active=false;
  assert.equal(effectSettings().iconSize,21);
  values.set('bg3-combat-bar.effectScale',100);
  assert.equal(effectSettings().iconSize,42);
  delete globalThis.game;
});
