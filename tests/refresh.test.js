import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatBar} from '../scripts/bar.js';
import {ID} from '../scripts/model.js';
import {cleanupEffects} from '../scripts/actions.js';

let run=0;
async function setup(t){
  const handlers=new Map(),frames=[];
  const globals=['Hooks','game','canvas','window','requestAnimationFrame','fromUuid'];
  const originals=Object.fromEntries(globals.map(key=>[key,globalThis[key]]));
  t.after(async()=>{await cleanupEffects();for(const key of globals){if(originals[key]===undefined)delete globalThis[key];else globalThis[key]=originals[key];}});
  const on=(name,callback)=>{if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(callback);};
  globalThis.Hooks={on,once:on};
  globalThis.window={addEventListener(){}};
  globalThis.requestAnimationFrame=callback=>frames.push(callback);
  const actor={id:'hero',uuid:'Actor.hero',documentName:'Actor',isOwner:true,type:'character',effects:[],getFlag(){}};
  const token={id:'hero',uuid:'Scene.test.Token.hero',documentName:'Token',actor,actorLink:true,parent:{id:'test'},x:0,y:0,elevation:0};
  const otherActor={...actor,id:'other',uuid:'Actor.other'};
  const other={...token,id:'other',uuid:'Scene.test.Token.other',actor:otherActor};
  const placeables=[{document:token,actor},{document:other,actor:otherActor}];
  globalThis.canvas={ready:true,scene:{id:'test'},tokens:{controlled:[placeables[0]],placeables}};
  globalThis.game={system:{id:'dnd5e'},modules:new Map([[ID,{}]]),user:{id:'gm',isGM:true},users:{activeGM:{id:'another-gm'}},settings:{get(){return false;}}};
  const render=t.mock.method(CombatBar.prototype,'render',function(){this.renders=(this.renders??0)+1;});
  const emit=async(name,...args)=>{await Promise.all((handlers.get(name)??[]).map(fn=>fn(...args)));};
  const flush=()=>{while(frames.length)frames.shift()();};
  await import(`../scripts/main.js?refresh-test=${++run}`);
  // Document hooks can run during loading, before the canvas or bar exists.
  const savedCanvas=globalThis.canvas;delete globalThis.canvas;
  await emit('updateToken',token,{x:1});
  globalThis.canvas=savedCanvas;
  await emit('ready');flush();render.mock.resetCalls();
  return {actor,token,other,otherActor,placeables,emit,flush,render,bar:game.modules.get(ID).api.bar};
}

test('repeated movement updates do not rebuild the current bar',async t=>{
  const {token,other,emit,flush,render}=await setup(t);
  for(let i=0;i<40;i++){
    for(const doc of [token,other]){
      doc.x+=100;
      await emit('updateToken',doc,{_id:doc.id,x:doc.x,y:100,elevation:20,rotation:90,_movementHistory:[],_regions:[]});
      flush();
    }
  }
  assert.equal(render.mock.callCount(),0,'Movement must not call CombatBar.render on subsequent animation frames');
});

test('flattened motion history and region updates do not render, mixed data changes do',async t=>{
  const {token,emit,flush,render}=await setup(t);
  for(const changes of [{rotation:180},{'_movementHistory.0.x':100},{'_regions.0':'region'},{elevation:30}]){
    await emit('updateToken',token,changes);flush();
  }
  assert.equal(render.mock.callCount(),0);
  for(const changes of [{x:200,flags:{[ID]:{economy:{action:0}}}},{y:100,[`flags.${ID}.layout.page`]:2},{elevation:0,delta:{system:{attributes:{hp:{value:10}}}}},{rotation:45,'delta.system.spells.spell1.value':1}]){
    const count=render.mock.callCount();await emit('updateToken',token,changes);flush();assert.equal(render.mock.callCount(),count+1);
  }
});

test('current actor resources, ownership, items and nested effects refresh; unrelated actors do not',async t=>{
  const {actor,otherActor,emit,flush,render}=await setup(t);
  const item={documentName:'Item',parent:actor},otherItem={documentName:'Item',parent:otherActor};
  const effect={documentName:'ActiveEffect',parent:actor},itemEffect={documentName:'ActiveEffect',parent:item};
  for(const changes of [{'system.attributes.hp.value':12},{'system.spells.spell1.value':0},{'flags.midi-qol.actions.reactionsUsed':1},{[`flags.${ID}.layout.page`]:2},{ownership:{default:0}},{img:'portrait.webp'}]){
    const count=render.mock.callCount();await emit('updateActor',actor,changes);flush();assert.equal(render.mock.callCount(),count+1);
    await emit('updateActor',otherActor,changes);flush();assert.equal(render.mock.callCount(),count+1);
  }
  for(const hook of ['createItem','updateItem','deleteItem','createActiveEffect','updateActiveEffect','deleteActiveEffect']){
    const current=hook.endsWith('Item')?item:effect,unrelated=hook.endsWith('Item')?otherItem:{documentName:'ActiveEffect',parent:otherItem};
    const count=render.mock.callCount();await emit(hook,current,{});flush();assert.equal(render.mock.callCount(),count+1);
    await emit(hook,unrelated,{});flush();assert.equal(render.mock.callCount(),count+1);
  }
  const count=render.mock.callCount();await emit('updateActiveEffect',itemEffect,{disabled:true});flush();assert.equal(render.mock.callCount(),count+1);
});

test('relevant token edits and actor relinking preserve refreshes',async t=>{
  const {token,other,otherActor,emit,flush,render,bar}=await setup(t);
  for(const changes of [{hidden:true},{name:'Renamed'},{texture:{src:'new.webp'}},{width:2},{actorLink:false},{flags:{[ID]:{layout:{page:3}}}}]){
    const count=render.mock.callCount();await emit('updateToken',token,changes);flush();assert.equal(render.mock.callCount(),count+1);
    await emit('updateToken',other,changes);flush();assert.equal(render.mock.callCount(),count+1);
  }
  token.actor=otherActor;
  const count=render.mock.callCount();await emit('updateToken',token,{actorId:otherActor.id});flush();
  assert.equal(bar.ctx.actor,otherActor);assert.equal(render.mock.callCount(),count+1);
});

test('selection changes once and synthetic tokens sharing a base actor stay distinct',async t=>{
  const {actor,token,other,placeables,emit,flush,render,bar}=await setup(t);
  const setContext=t.mock.method(bar,'setContext');
  canvas.tokens.controlled.push(placeables[1]);await emit('controlToken',placeables[1],true);flush();
  assert.equal(bar.ctx.token,other);assert.equal(setContext.mock.callCount(),1);
  await emit('controlToken',placeables[1],true);flush();assert.equal(setContext.mock.callCount(),1);
  canvas.tokens.controlled=[placeables[0]];await emit('controlToken',placeables[1],false);flush();assert.equal(bar.ctx.token,token);
  const synthetic={...actor,uuid:`${token.uuid}.Actor.hero`};token.actor=synthetic;token.actorLink=false;token.baseActor=actor;
  await emit('updateToken',token,{actorLink:false});flush();assert.equal(bar.ctx.document,token);
  let count=render.mock.callCount();await emit('updateActor',{...synthetic,uuid:`${other.uuid}.Actor.hero`},{'system.attributes.hp.value':9});flush();assert.equal(render.mock.callCount(),count);
  await emit('updateActor',synthetic,{'system.attributes.hp.value':9});flush();assert.equal(render.mock.callCount(),++count);
  await emit('updateActor',actor,{ownership:{default:0}});flush();assert.equal(render.mock.callCount(),++count);
  // Foundry can replace the synthetic Actor without changing its UUID.
  token.actor={...synthetic};await emit('updateToken',token,{x:300});flush();assert.equal(bar.ctx.actor,token.actor);assert.equal(render.mock.callCount(),++count);
});

test('fallback selection, user assignment, token lifecycle, combat and settings still update',async t=>{
  const {actor,token,other,otherActor,placeables,emit,flush,render,bar}=await setup(t);
  canvas.tokens.controlled=[];game.user.character=otherActor;
  await emit('updateUser',game.user,{character:otherActor.id});flush();assert.equal(bar.ctx.token,other);
  canvas.tokens.placeables=[placeables[0]];await emit('deleteToken',other);flush();assert.equal(bar.ctx,null);
  canvas.tokens.placeables.push(placeables[1]);await emit('createToken',other);flush();assert.equal(bar.ctx.token,other);
  const combat={id:'fight',combatant:{token},started:true};game.combat=combat;
  await emit('createCombat',combat);flush();assert.equal(bar.ctx.token,token);
  const count=render.mock.callCount();await emit('updateCombat',{id:'unrelated'},{turn:1});flush();assert.equal(render.mock.callCount(),count);
  await emit('updateCombat',combat,{turn:1});flush();assert.equal(render.mock.callCount(),count+1);
  await emit('updateCombatant',{parent:combat},{initiative:20});flush();assert.equal(render.mock.callCount(),count+2);
  game.combat=null;await emit('deleteCombat',combat);flush();assert.equal(bar.ctx.token,other);
  const after=render.mock.callCount();await emit('updateSetting',{key:'visual-active-effects.hidePassive'});flush();assert.equal(render.mock.callCount(),after+1);
  await emit('updateUser',game.user,{[`flags.${ID}.sections`]:{}});flush();assert.equal(render.mock.callCount(),after+2);
  await emit('canvasTearDown');flush();assert.equal(bar.ctx,null);
  await emit('canvasReady');flush();assert.equal(bar.ctx.actor,otherActor);
  game.user.character=actor;canvas.tokens.controlled=[placeables[0]];
  game.modules.get(ID).api.refresh();flush();assert.equal(bar.ctx.token,token);
});

test('movement still cleans up a grapple and only the resulting effect change rebuilds the bar',async t=>{
  const {actor,token,other,otherActor,emit,flush,render}=await setup(t);
  game.users.activeGM=game.user;game.actors=[actor,otherActor];
  canvas.scene.grid={units:'ft'};canvas.grid={size:100,measurePath:points=>({distance:Math.hypot(points[1].x,points[1].y)/20})};
  for(const doc of [token,other])Object.assign(doc,{width:1,height:1});
  actor.statuses=otherActor.statuses=new Set();other.x=100;
  globalThis.fromUuid=async uuid=>[token,other].find(doc=>doc.uuid===uuid);
  const flags={kind:'grapple',source:other.uuid,target:token.uuid};
  const effect={id:'grapple',documentName:'ActiveEffect',parent:actor,getFlag:(_id,key)=>flags[key]};
  actor.effects=[effect];otherActor.effects=[];
  actor.deleteEmbeddedDocuments=async(type,ids)=>{assert.equal(type,'ActiveEffect');assert.deepEqual(ids,['grapple']);actor.effects=[];await emit('deleteActiveEffect',effect);};
  await emit('updateToken',other,{x:100});flush();assert.equal(render.mock.callCount(),0);assert.equal(actor.effects.length,1);
  other.x=400;await emit('updateToken',other,{x:400});flush();
  assert.equal(actor.effects.length,0);assert.equal(render.mock.callCount(),1);
  other.x=500;await emit('updateToken',other,{x:500});flush();assert.equal(render.mock.callCount(),1);
});

test('native activity and rest completion refresh only the displayed actor',async t=>{
  const {actor,token,other,otherActor,emit,flush,render}=await setup(t);
  actor.getActiveTokens=()=>[token];otherActor.getActiveTokens=()=>[other];
  actor.setFlag=otherActor.setFlag=async()=>{};
  for(const owner of [actor,otherActor]){
    await emit('dnd5e.postUseActivity',{actor:owner,activation:{type:'special'},item:{type:'feat'}},{},{});flush();
    assert.equal(render.mock.callCount(),1);
  }
  for(const owner of [actor,otherActor]){
    await emit('dnd5e.restCompleted',owner,{longRest:true});flush();
    assert.equal(render.mock.callCount(),2);
  }
});
