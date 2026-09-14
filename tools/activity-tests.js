import {ID} from '../scripts/model.js';
import {context,editLayout} from '../scripts/state.js';
import {usableActivities} from '../scripts/activity-choices.js';
export async function run(){
  if(!['localhost','127.0.0.1'].includes(location.hostname)||!game.user.isGM)throw Error('Local GM tests only.');
  const actor=game.actors.find(a=>a.getFlag(ID,'resourceFixture')==='multiclass'),token=canvas.tokens.placeables.find(t=>t.actor?.id===actor?.id);
  if(!token)throw Error('Open the BG3 test arena.');
  const orb={name:'BG3 Chromatic Orb',type:'spell',img:`modules/${ID}/assets/d20.svg`,flags:{[ID]:{activityFixture:'orb'},dnd5e:{riders:{activity:['FppS3cgYVXIYGTVf']}},'chris-premades':{hiddenActivities:['chromaticOrbBounce'],activityIdentifiers:{chromaticOrbBounce:'FppS3cgYVXIYGTVf'}}},system:{level:1,method:'spell',prepared:1,activities:{attackChromOrbII:{type:'attack',name:'Cast',activation:{type:'action'},consumption:{spellSlot:true}},FppS3cgYVXIYGTVf:{type:'attack',name:'Bounce',activation:{type:'special'},consumption:{spellSlot:false}}}}};
  const command={name:'BG3 Command',type:'spell',img:`modules/${ID}/assets/hide.svg`,flags:{[ID]:{activityFixture:'command'}},system:{level:1,method:'spell',prepared:1,activities:Object.fromEntries(['Approach','Drop','Flee','Grovel','Halt'].map((name,i)=>[`bg3commandtest0${i}`,{type:'save',name,activation:{type:'action'},midiProperties:{otherActivityCompatible:false}}]))}};
  const items=[];for(const data of [orb,command]){let item=actor.items.find(i=>i.getFlag(ID,'activityFixture')===data.flags[ID].activityFixture);if(item)await item.update(data);else [item]=await actor.createEmbeddedDocuments('Item',[data]);items.push(item);}
  // Foundry assigns fresh activity IDs on embedded creation; attach rider references afterwards.
  const bounce=items[0].system.activities.find(a=>a.name==='Bounce');
  await items[0].update({'flags.dnd5e.riders.activity':[bounce.id],'flags.chris-premades.hiddenActivities':['chromaticOrbBounce'],'flags.chris-premades.activityIdentifiers.chromaticOrbBounce':bounce.id});
  if(usableActivities(items[0]).length!==1||usableActivities(items[1]).length!==5)throw Error('Manual activity counts do not match 1 / 5.');
  token.control({releaseOthers:true});await editLayout(context(token.document),d=>{d.page=0;d.pages[0].spells.splice(0,2,...items.map(i=>i.id));});
  const bar=game.modules.get(ID).api.bar;bar.macroMode=false;bar.render();ui.notifications.info('Passed: Chromatic Orb has 1 manual activity; Command has 5.');
}
