import {ID} from '../scripts/model.js';
import {effectExpired,collectEffects} from '../scripts/effect-model.js';
import {effectSettings} from '../scripts/effects.js';
export async function run(){
  if(!['localhost','127.0.0.1'].includes(location.hostname)||!game.user.isGM)throw Error('Local GM tests only.');
  const actor=game.actors.find(a=>a.getFlag(ID,'resourceFixture')==='multiclass');
  const results=[],check=(ok,message)=>{if(!ok)throw Error(message);};
  const duration=game.release.generation>=14?{start:{time:game.time.worldTime-120},duration:{value:60,units:'seconds'}}:{duration:{startTime:game.time.worldTime-120,seconds:60}};
  const [effect]=await actor.createEmbeddedDocuments('ActiveEffect',[{name:'BG3 compatibility effect',img:`modules/${ID}/assets/dash.svg`,description:'<p>A temporary effect for testing <strong>expiration</strong> and cancellation.</p>',transfer:false,...duration}]);
  try{
    effect.updateDuration();check(effect.isTemporary&&effectExpired(effect),'Expired temporary effect not recognized');
    check(collectEffects(actor,effectSettings(),CONST.ACTIVE_EFFECT_SHOW_ICON).some(e=>e.effect.id===effect.id),'Temporary effect missing from dock');
    results.push('PASS temporary effect filtering and expiration');
    await effect.update({disabled:true});check(effect.disabled,'Effect disable failed');await effect.update({disabled:false});
    results.push('PASS effect disable and enable');
  }finally{await effect.delete();}
  check(!actor.effects.has(effect.id),'Effect deletion failed');results.push('PASS effect cancellation');
  const [sample]=await actor.createEmbeddedDocuments('ActiveEffect',[{name:'BG3 tooltip test',img:`modules/${ID}/assets/hide.svg`,description:'<p>Compatibility check: <strong>duration and cancellation</strong>.</p>',transfer:false,...(game.release.generation>=14?{duration:{value:600,units:'seconds'}}:{duration:{seconds:600,startTime:game.time.worldTime}})}]);
  canvas.tokens.placeables.find(t=>t.actor?.id===actor.id)?.control({releaseOthers:true});game.modules.get(ID).api.bar.macroMode=false;game.modules.get(ID).api.refresh();
  await foundry.applications.api.DialogV2.prompt({window:{title:'BG3 compatibility results'},content:`<p>Foundry ${game.version}; D&D5e ${game.system.version}</p>${results.map(r=>`<p>${r}</p>`).join('')}<p>Hover and right-click ${sample.name} to finish the UI check.</p>`});
}

export async function install(){
  if(!['localhost','127.0.0.1'].includes(location.hostname)||!game.user.isGM)throw Error('Local GM tests only.');
  const tests=[['Live','live-tests',false],['Resources','resource-tests',true],['Items','item-tests',true],['Activities','activity-tests',true],['Compatibility','compatibility-tests',true],['Sections','section-tests',true]];
  for(const [i,[name,file,run]] of tests.entries()){
    const command=`await (await import('/modules/${ID}/tools/${file}.js?run='+Date.now()))${run?'.run()':''};`;
    let macro=game.macros.find(m=>m.name===`BG3 ${name} tests`);
    if(macro)await macro.update({command});else macro=await Macro.create({name:`BG3 ${name} tests`,type:'script',command});
    await game.user.assignHotbarMacro(macro,i+2);
  }
  await import('./fixture.js');
}
