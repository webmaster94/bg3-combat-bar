import {ID} from '../scripts/model.js';
import {addGroup} from '../scripts/groups.js';
export async function setup(){
  if(!['127.0.0.1','localhost'].includes(location.hostname)||!game.user.isGM)throw Error('Local GM test only.');
  const actor=game.actors.find(a=>a.getFlag(ID,'resourceFixture')==='multiclass');
  if(!actor)throw Error('Run the resource fixture first.');
  const token=actor.getActiveTokens(false,true)[0];if(!token)throw Error('Activate the resource test arena first.');
  const modern=Number(game.system.version.split('.')[0])>=6;
  await actor.update({[`system.attributes.movement.${modern?'speeds.':''}walk`]:30,[`system.attributes.movement.${modern?'speeds.':''}fly`]:60,[`system.attributes.senses.${modern?'ranges.':''}darkvision`]:60,[`system.attributes.senses.${modern?'ranges.':''}blindsight`]:10});
  await token.update({name:'HUD Test Token','sight.enabled':true,'sight.visionMode':'darkvision','sight.range':60,detectionModes:game.release.generation>=14?{blindsight:{enabled:true,range:10}}:[{id:'blindsight',enabled:true,range:10}]});
  const api=game.modules.get(ID).api,ctx=api.context(token),data=api.layout(ctx);
  data.locked=false;data.page=0;data.rows=2;data.groups=[];data.pages[0].features.fill(null);
  data.pages[0].features[0]=actor.items.find(i=>i.name==='BG3 Empty Feature')?.id;
  data.pages[0].features[1]=actor.items.find(i=>i.name==='BG3 Activity Menu')?.id;
  for(const [id,name,slots] of [['offense','Offense',[0,1]],['utility','Utility',[2,3]],['defense','Defense',[12,13]]])addGroup(data,slots.map(index=>({section:'features',index})),name,id);
  data.widths.features=174;await ctx.document.setFlag(ID,'layout',data);
  token.object.control({releaseOthers:true});api.bar.macroMode=false;api.refresh();
  ui.notifications.info('HUD fixture ready: test page arrows, Play resizing, name editing, movement, sight, and adjacent group colors.');
}
