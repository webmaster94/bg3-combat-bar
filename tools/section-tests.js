import {ID} from '../scripts/model.js';
import {context,editLayout} from '../scripts/state.js';
export async function run(){
  if(!['localhost','127.0.0.1'].includes(location.hostname)||!game.user.isGM)throw Error('Local GM tests only.');
  const actor=game.actors.find(a=>a.getFlag(ID,'resourceFixture')==='multiclass');
  const token=canvas.tokens.placeables.find(t=>t.actor?.id===actor?.id);if(!token)throw Error('Open the BG3 resource test arena.');
  const names=['Arcane Ward','Quick Step','Spark'];
  let item=actor.items.find(i=>i.getFlag(ID,'sectionFixture')==='activities');
  if(!item)[item]=await actor.createEmbeddedDocuments('Item',[{name:'BG3 Versatile Charm',type:'feat',img:`modules/${ID}/assets/d20.svg`,flags:{[ID]:{sectionFixture:'activities'}},system:{description:{value:'<p>A local fixture with three distinct activities for the pop-out grid.</p>'},uses:{max:'4',spent:0},activities:Object.fromEntries(names.map((name,i)=>[`bg3activitytest0${i}`,{type:'utility',name,img:`modules/${ID}/assets/${['hide','dash','swords'][i]}.svg`,sort:i*10,description:{chatFlavor:`<p>${name} has its own activity details.</p>`},activation:{type:i===1?'bonus':'special'},uses:i===0?{max:'2',spent:0}:undefined,consumption:{targets:[{type:'itemUses',target:'',value:'1'}]}}]))}}]);
  for(const [key,name,type] of [['spell','BG3 Test Cantrip','spell'],['item','BG3 Test Trinket','loot']])if(!actor.items.some(i=>i.getFlag(ID,'sectionFixture')===key))await actor.createEmbeddedDocuments('Item',[{name,type,img:`modules/${ID}/assets/${type==='spell'?'d20':'rest'}.svg`,flags:{[ID]:{sectionFixture:key}},system:{level:0,description:{value:'<p>Local mixed-section assignment fixture.</p>'}}}]);
  await item.update({'system.uses.spent':0});token.control({releaseOthers:true});
  const ctx=context(token.document);await editLayout(ctx,d=>{d.pages[0].features[0]=item.id;d.page=0;});
  const bar=game.modules.get(ID).api.bar;bar.macroMode=false;bar.render();
  ui.notifications.info('BG3 section fixtures ready. Click the Versatile Charm to select an activity.');
}
