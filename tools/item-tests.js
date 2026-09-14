import {ID} from '../scripts/model.js';
import {context,editLayout} from '../scripts/state.js';
import {itemState} from '../scripts/item-state.js';
export async function run(){
  if(!['localhost','127.0.0.1'].includes(location.hostname)||!game.user.isGM)throw Error('Local GM tests only.');
  const actor=game.actors.find(a=>a.getFlag(ID,'resourceFixture')==='multiclass'),token=canvas.tokens.placeables.find(t=>t.actor?.id===actor?.id);
  if(!token)throw Error('Open BG3 resource test arena.');
  const utility=(name,extra={})=>({type:'utility',name,activation:{type:'action'},...extra});
  const definitions=[
    ['Unprepared Sanctuary','spell','d20',{level:1,method:'spell',prepared:0,activities:{bg3availability0:utility('Sanctuary')}}],
    ['Upcast Test','spell','rest',{level:1,method:'spell',prepared:1,activities:{bg3availability0:utility('Cast')}}],
    ['At Will Test','spell','hide',{level:0,method:'atwill',prepared:1,activities:{bg3availability0:utility('Cast')}}],
    ['Potion Stack','consumable','rest',{quantity:4,uses:{max:'1',spent:0},activities:{bg3availability0:utility('Drink',{consumption:{targets:[{type:'itemUses',value:'1'}]}})}}],
    ['Unattuned Charm','equipment','swords',{attunement:'required',attuned:false,properties:['mgc'],activities:{bg3availability0:utility('Magic',{visibility:{requireAttunement:true,requireMagic:true}})}}],
    ['Empty Feature','feat','shove',{uses:{max:'2',spent:2},activities:{bg3availability0:utility('Spend',{consumption:{targets:[{type:'itemUses',value:'1'}]}})}}],
    ['Activity Menu','feat','dash',{uses:{max:'2',spent:1},activities:{bg3availability0:utility('Free activity'),bg3availability1:utility('Charge activity',{consumption:{targets:[{type:'itemUses',value:'1'}]}}),bg3availability2:utility('Empty activity',{uses:{max:'1',spent:1},consumption:{targets:[{type:'activityUses',value:'1'}]}})}}]
  ];
  const items=[];
  for(const [name,type,img,system] of definitions){
    const data={name:`BG3 ${name}`,type,img:`modules/${ID}/assets/${img}.svg`,flags:{[ID]:{itemFixture:name}},system:{...system,description:{value:`<p>Local test: ${name}.</p>`}}};
    let i=actor.items.find(i=>i.getFlag(ID,'itemFixture')===name);if(i)await i.update(data);else [i]=await actor.createEmbeddedDocuments('Item',[data]);items.push(i);
  }
  await actor.update({'system.spells.spell1.value':0,'system.spells.spell2.value':1});
  token.control({releaseOthers:true});await editLayout(context(token.document),d=>{d.page=0;d.pages[0].spells.splice(0,3,...items.slice(0,3).map(i=>i.id));d.pages[0].items.splice(0,2,...items.slice(3,5).map(i=>i.id));d.pages[0].features.splice(0,2,...items.slice(5).map(i=>i.id));});
  const bar=game.modules.get(ID).api.bar;bar.macroMode=false;bar.render();
  const states=items.map(i=>({name:i.name,...itemState(i,null,actor)}));
  await foundry.applications.api.DialogV2.wait({window:{title:'BG3 item test results'},content:`<pre>${states.map(s=>`${s.name}: ${s.badge||'no badge'}${s.quantity?' ×'+s.quantity:''} · ${s.reasons.join('; ')||'Available'}`).join('\n')}</pre>`,buttons:[{action:'close',label:'Close'}]});
}
