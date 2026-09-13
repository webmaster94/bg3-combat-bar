import {ID} from '../scripts/model.js';
import {classResources} from '../scripts/resources.js';
import {context,economy,setEconomy,midiReactions} from '../scripts/state.js';
const cases=[
  {key:'multiclass',name:'Monk / Wizard',classes:[['monk',6],['wizard',3]],feature:"Monk's Focus",identifier:'monks-focus',max:'@classes.monk.levels',kind:'monk',casting:true,period:'sr'},
  {key:'monk',name:'Monk',classes:[['monk',8]],feature:'Ki',identifier:'monks-focus',max:'@classes.monk.levels',kind:'monk',casting:false,period:'sr'},
  {key:'sorcerer',name:'Sorcerer',classes:[['sorcerer',20]],feature:'Font of Magic',identifier:'font-of-magic',max:'@classes.sorcerer.levels',kind:'sorcery',casting:true,period:'lr'},
  {key:'feat',name:'Noncaster with Metamagic Adept',classes:[['fighter',4]],feature:'Metamagic Adept',identifier:'metamagic-adept',max:'2',kind:'sorcery',casting:false,period:'lr'}
];
function localOnly(){if(!['localhost','127.0.0.1'].includes(location.hostname)||!game.user.isGM)throw Error('Local GM resource tests only.');}
export async function prepareMidi(){
  localOnly();
  const actor=game.actors.find(a=>a.getFlag(ID,'resourceFixture')==='multiclass');
  if(!actor.getFlag(ID,'midiTestBackup'))await actor.setFlag(ID,'midiTestBackup',game.settings.get('midi-qol','ConfigSettings'));
  await game.settings.set('midi-qol','ConfigSettings',{...game.settings.get('midi-qol','ConfigSettings'),enforceReactions:'displayOnly'});
  location.reload();
}
export async function finishMidi(){
  localOnly();const actor=game.actors.find(a=>a.getFlag(ID,'resourceFixture')==='multiclass'),ctx=context(canvas.scene.tokens.find(t=>t.actorId===actor.id));
  let result;
  try{
    if(!midiReactions(actor))throw Error('Midi reaction tracking is not active');
    await setEconomy(ctx,'reaction',true);await setEconomy(ctx,'reaction');
    if(economy(ctx).reaction!==0)throw Error('Bar spend did not update Midi');
    await setEconomy(ctx,'reaction',true);await MidiQOL.setReactionUsed(actor);
    if(economy(ctx).reaction!==0)throw Error('Midi external reaction did not update bar');
    await MidiQOL.removeReactionUsed(actor,true);
    if(economy(ctx).reaction!==1)throw Error('Midi restore did not update bar');
    const [item]=await actor.createEmbeddedDocuments('Item',[{name:'BG3 test reaction',type:'feat',system:{activities:{bg3reacttest0001:{type:'utility',activation:{type:'reaction'}}}}}]);
    try{await item.use({subsequentActions:false},{configure:false});
      if(economy(ctx).reaction!==0||actor.getFlag('midi-qol','actions')?.reactionsUsed!==1)throw Error('Reaction activity was not consumed exactly once');
    }finally{await item.delete();}
    result='PASS: Midi bar spend/restore, external reaction, and native reaction activity with no double consumption.';
  }catch(error){result=`FAIL: ${error.message}`;console.error('BG3 Midi resource test',error);}
  finally{await MidiQOL.removeReactionUsed(actor,true);const backup=actor.getFlag(ID,'midiTestBackup');if(backup){await game.settings.set('midi-qol','ConfigSettings',backup);await actor.unsetFlag(ID,'midiTestBackup');}}
  await foundry.applications.api.DialogV2.prompt({window:{title:'BG3 Midi reaction verification'},content:`<p>${result}</p><p>Original Midi configuration restored.</p>`});
}
export async function run(){
  if(!['localhost','127.0.0.1'].includes(location.hostname)||!game.user.isGM)throw Error('Local GM resource tests only.');
  const actors=[],results=[];
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  for(const c of cases){
    let actor=game.actors.find(a=>a.getFlag(ID,'resourceFixture')===c.key);
    if(!actor){
      actor=await Actor.create({name:`BG3 resource test · ${c.name}`,type:'character',img:c.kind==='monk'?'icons/skills/melee/unarmed-punch-fist.webp':'icons/magic/symbols/runes-star-magenta.webp',flags:{[ID]:{resourceFixture:c.key}},system:{attributes:{hp:{value:35,max:35},spellcasting:c.casting?'int':''}},prototypeToken:{actorLink:true}});
      await actor.createEmbeddedDocuments('Item',c.classes.map(([name,levels])=>({name,type:'class',system:{identifier:name,levels,spellcasting:{progression:['wizard','sorcerer'].includes(name)?'full':'none',ability:name==='sorcerer'?'cha':'int'}}})));
      await actor.createEmbeddedDocuments('Item',[{name:c.feature,type:'feat',img:actor.img,system:{identifier:c.identifier,description:{value:`<p>Local test resource for ${c.name}. Uses come from the system feature; one point is spent by the test activity.</p>`},uses:{max:c.max,spent:0,recovery:[{period:c.period,type:'recoverAll'}]},activities:{bg3pointtest0001:{type:'utility',name:'Spend a point',activation:{type:'special'},consumption:{targets:[{type:'itemUses',target:'',value:'1'}]}}}}}]);
    }
    actors.push(actor);
    try{
      const item=actor.items.find(i=>i.system.identifier===c.identifier);
      await item.update({'system.uses.spent':0});
      let pool=classResources(actor)[0];
      check(pool?.kind===c.kind&&pool.max>0,'Class resource detection');
      check(Object.values(actor.system.spells).some(s=>s.max>0)===c.casting,'Spellcasting detection');
      const maximum=pool.max;
      await item.use({subsequentActions:false},{configure:false});
      pool=classResources(actor)[0];check(pool.value===maximum-1,'Native item use did not spend one point');
      await actor[c.period==='sr'?'shortRest':'longRest']({dialog:false,chat:false,advanceTime:false,advanceBastionTurn:false});
      check(classResources(actor)[0].value===maximum,'Native rest did not restore the pool');
      await item.update({'system.uses.spent':c.key==='feat'?1:2});
      results.push(`${c.name}: PASS detection, native use, and rest recovery`);
    }catch(error){results.push(`${c.name}: FAIL ${error.message}`);console.error('BG3 resource test',error);}
  }
  let scene=game.scenes.find(s=>s.getFlag(ID,'resourceFixture'));
  if(!scene){scene=await Scene.create({name:'BG3 resource test arena',width:1800,height:1000,padding:.1,backgroundColor:'#29312b',grid:{type:1,size:100,distance:5,units:'ft'},tokenVision:false,flags:{[ID]:{resourceFixture:true}}});
    await scene.createEmbeddedDocuments('Token',await Promise.all(actors.map(async(a,i)=>(await a.getTokenDocument({x:300+i*300,y:450,actorLink:true})).toObject())));
  }
  await scene.activate();await scene.view();
  let combat=game.combats.find(c=>c.scene?.id===scene.id);
  if(!combat){combat=await Combat.create({scene:scene.id,active:true});await combat.createEmbeddedDocuments('Combatant',scene.tokens.map((t,i)=>({tokenId:t.id,actorId:t.actorId,sceneId:scene.id,initiative:20-i*3})));await combat.startCombat();}
  else await combat.activate();
  const ctx=context(scene.tokens.find(t=>t.actorId===actors[0].id));
  try{await setEconomy(ctx,'reaction',true);await setEconomy(ctx,'reaction');check(economy(ctx).reaction===0,'Reaction spend');await setEconomy(ctx,'reaction',true);check(economy(ctx).reaction===1,'Reaction restore');results.push(`Reaction: PASS spend/restore; Midi authority ${midiReactions(ctx.actor)}`);}catch(error){results.push(`Reaction: FAIL ${error.message}`);}
  const bar=game.modules.get(ID).api.bar;bar.macroMode=false;
  const choice=await foundry.applications.api.DialogV2.wait({window:{title:'BG3 resource test results'},content:results.map(r=>`<p>${r}</p>`).join(''),buttons:cases.map((c,i)=>({action:c.key,label:c.name,callback:()=>i})),rejectClose:false});
  const actor=actors[typeof choice==='number'?choice:0];
  canvas.tokens.placeables.find(t=>t.actor?.id===actor.id)?.control({releaseOthers:true});
  game.modules.get(ID).api.refresh();
}
