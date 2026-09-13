import {ID} from '../scripts/model.js';
import {effectSettings} from '../scripts/effects.js';
Hooks.on('visual-active-effects.createEffectButtons',(effect,buttons)=>{
  if(effect.getFlag(ID,'effectFixture'))buttons.push({label:'Test effect button',callback:()=>ui.notifications.info('BG3 effect button invoked')});
});
Hooks.on('visual-active-effects.prepareActiveEffectContext',effect=>{if(effect.getFlag(ID,'hiddenByHook'))return false;});
export async function run(){
  if(!['localhost','127.0.0.1'].includes(location.hostname)||!game.user.isGM)throw Error('Local GM effect tests only.');
  const actor=game.actors.find(a=>a.getFlag(ID,'resourceFixture')==='multiclass');
  if(!actor)throw Error('Create the resource test fixtures first.');
  canvas.tokens.placeables.find(t=>t.actor?.id===actor.id)?.control({releaseOthers:true});
  const bar=game.modules.get(ID).api.bar;bar.macroMode=false;bar.render();
  const mode=await foundry.applications.api.DialogV2.wait({window:{title:'BG3 effect test fixtures'},content:'<p>Choose the number of test effects. Only marked local test effects are replaced.</p>',buttons:[['one','One full row'],['two','Two full rows'],['overflow','Overflow two rows'],['filters','Filters and item effects'],['clear','Clear test effects']].map(([action,label])=>({action,label})),rejectClose:false});
  if(!mode)return;
  const previous=actor.effects.filter(e=>e.getFlag(ID,'effectFixture')).map(e=>e.id);if(previous.length)await actor.deleteEmbeddedDocuments('ActiveEffect',previous);
  const items=actor.items.filter(i=>i.getFlag(ID,'effectFixture')).map(i=>i.id);if(items.length)await actor.deleteEmbeddedDocuments('Item',items);
  if(mode==='clear')return;
  const prefs=effectSettings(),main=bar.root.querySelector('.bg3-main'),resources=bar.root.querySelector('.bg3-resources');
  const scale=main.getBoundingClientRect().width/main.offsetWidth,oldExpansion=parseFloat(bar.root.style.getPropertyValue('--effects-expand'))||0;
  const available=(main.getBoundingClientRect().right-resources.getBoundingClientRect().right)/scale-24-oldExpansion/2-prefs.rightOffset;
  const capacity=Math.max(1,Math.floor((available+4)/(prefs.iconSize+4)));
  const count=mode==='one'?capacity:mode==='two'?capacity*2:mode==='overflow'?capacity*2+3:4;
  const data=Array.from({length:count},(_,i)=>({name:`BG3 effect ${String(i+1).padStart(2,'0')}`,img:`modules/${ID}/assets/${['dash','disengage','hide','shove','grapple','swords'][i%6]}.svg`,description:`<p>Test effect ${i+1}: this description explains the condition and supports <strong>formatted rules text</strong>.</p>`,origin:actor.uuid,transfer:false,start:{time:game.time.worldTime},duration:{value:600,units:'seconds'},flags:{[ID]:{effectFixture:true}}}));
  if(mode==='filters')data.push(
    {name:'BG3 passive test',img:`modules/${ID}/assets/d20.svg`,transfer:false,flags:{[ID]:{effectFixture:true}}},
    {name:'BG3 disabled test',img:`modules/${ID}/assets/hide.svg`,disabled:true,duration:{value:600,units:'seconds'},flags:{[ID]:{effectFixture:true}}},
    {name:'BG3 always-show test',img:`modules/${ID}/assets/rest.svg`,showIcon:CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS,flags:{[ID]:{effectFixture:true}}},
    {name:'BG3 never-show test',img:`modules/${ID}/assets/rest.svg`,showIcon:CONST.ACTIVE_EFFECT_SHOW_ICON.NEVER,flags:{[ID]:{effectFixture:true}}},
    {name:'BG3 hook-hidden test',img:`modules/${ID}/assets/rest.svg`,duration:{value:600,units:'seconds'},flags:{[ID]:{effectFixture:true,hiddenByHook:true}}}
  );
  await actor.createEmbeddedDocuments('ActiveEffect',data);
  if(mode==='filters'){
    const [item]=await actor.createEmbeddedDocuments('Item',[{name:'BG3 enchanted item test',type:'equipment',system:{equipped:true},flags:{[ID]:{effectFixture:true}}}]);
    await item.createEmbeddedDocuments('ActiveEffect',[{name:'BG3 item effect',type:'enchantment',origin:actor.uuid,img:`modules/${ID}/assets/swords.svg`,transfer:false,duration:{value:600,units:'seconds'},flags:{[ID]:{effectFixture:true}}}]);
  }
  ui.notifications.info(`Created ${count} main test effects; original one-row capacity ${capacity}.`);
}
