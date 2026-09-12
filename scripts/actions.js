import {ID, GENERICS, escapeHTML as esc, sizeAllowed, turnKey} from "./model.js";
import {context, consume, canSpend, actionCost, isTurn, serial} from "./state.js";
import {choose, confirm} from "./dialogs.js";

const activeGM = () => game.users.activeGM?.id === game.user.id;
const feet = n => canvas.scene.grid.units === "m" ? n * 0.3 : n;
const getToken = async uuid => { const doc=await fromUuid(uuid); if(doc?.documentName!=="Token") throw new Error("Select a token on the scene.");return doc; };
const center = t => ({x:t.x+t.width*canvas.grid.size/2,y:t.y+t.height*canvas.grid.size/2});
function distance(a,b) {
  const ac=center(a),bc=center(b),s=canvas.grid.size;
  const dx=Math.max(0,Math.abs(ac.x-bc.x)-Math.max(0,a.width+b.width-2)*s/2);
  const dy=Math.max(0,Math.abs(ac.y-bc.y)-Math.max(0,a.height+b.height-2)*s/2);
  return canvas.grid.measurePath([{x:0,y:0},{x:dx,y:dy}]).distance;
}
function targetValid(source,target) {
  if (source.parent.id!==canvas.scene.id || target.parent.id!==source.parent.id || source.id===target.id) throw new Error("Target another creature on the current scene.");
  if (!target.actor || !["character","npc"].includes(target.actor.type)) throw new Error("Target a creature.");
  // Edge-to-edge distance includes the adjacent 5-foot space occupied by the target.
  if (distance(source,target)>feet(5)+0.01 || Math.abs(source.elevation-target.elevation)>feet(5)) throw new Error("The target must be within 5 feet.");
  if (!sizeAllowed(source.actor.system.traits.size,target.actor.system.traits.size)) throw new Error("The target is more than one size larger.");
  if (CONFIG.Canvas.polygonBackends.move.testCollision(center(source),center(target),{type:"move",mode:"any"})) throw new Error("A wall blocks the target.");
}
export function validDestination(source,target,end) {
  if (!Number.isFinite(end?.x)||!Number.isFinite(end?.y)) return false;
  const start=center(target), src=center(source), half={x:target.width*canvas.grid.size/2,y:target.height*canvas.grid.size/2};
  const dest={x:end.x+half.x,y:end.y+half.y};
  const dist=canvas.grid.measurePath([start,dest]).distance;
  if (Math.abs(dist-feet(5))>0.05) return false;
  if ((dest.x-start.x)*(start.x-src.x)+(dest.y-start.y)*(start.y-src.y)<=0) return false;
  if (Math.hypot(dest.x-src.x,dest.y-src.y)<=Math.hypot(start.x-src.x,start.y-src.y)) return false;
  const rect=canvas.dimensions.sceneRect;
  if(!rect.contains(end.x,end.y)||!rect.contains(end.x+half.x*2,end.y+half.y*2)) return false;
  if(target.object?.checkCollision(dest,{origin:start,type:"move",mode:"any"}))return false;
  return !canvas.tokens.placeables.some(t=>t.id!==target.id && end.x<t.document.x+t.w-1 && end.x+half.x*2>t.document.x+1 && end.y<t.document.y+t.h-1 && end.y+half.y*2>t.document.y+1 && Math.abs(t.document.elevation-target.elevation)<feet(5));
}
export async function chooseDestination(source,target) {
  const size=canvas.grid.size, steps=Math.ceil(feet(5)/canvas.scene.grid.distance), points=[];
  if(canvas.scene.grid.type===CONST.GRID_TYPES.GRIDLESS) {
    const radius=feet(5)/canvas.scene.grid.distance*size;
    for(let i=0;i<32;i++){const angle=i*Math.PI/16;const p={x:target.x+Math.cos(angle)*radius,y:target.y+Math.sin(angle)*radius};if(validDestination(source,target,p))points.push(p);}
  } else {
    for(let x=-steps;x<=steps;x++)for(let y=-steps;y<=steps;y++){
      const p=target.object.getSnappedPosition({x:target.x+x*size,y:target.y+y*size});
      if(validDestination(source,target,p) && !points.some(q=>q.x===p.x&&q.y===p.y))points.push(p);
    }
  }
  if(!points.length)throw new Error("No unoccupied shove destination is available. Try knocking the target prone.");
  ui.notifications.info("Choose a gold circle to push the target 5 feet away. Escape cancels.");
  const graphics=new PIXI.Graphics();graphics.eventMode="none";canvas.stage.addChild(graphics);
  const origin=center(target), radius=feet(5)/canvas.scene.grid.distance*size;
  graphics.lineStyle(2,0xdcc184,0.5).drawCircle(origin.x,origin.y,radius);
  for(const p of points){const c=center({...target,x:p.x,y:p.y});graphics.lineStyle(2,0xffdf97,1).beginFill(0xb99446,0.3).drawCircle(c.x,c.y,size*0.23).endFill();}
  return new Promise(resolve=>{
    const done=p=>{canvas.stage.off("pointerdown",click);document.removeEventListener("keydown",key);Hooks.off("canvasTearDown",teardown);graphics.destroy();resolve(p);};
    const click=e=>{if(e.button!==0)return;const p=e.getLocalPosition(canvas.stage);const selected=points.find(q=>{const c=center({...target,x:q.x,y:q.y});return Math.hypot(c.x-p.x,c.y-p.y)<size*0.3;});if(selected){e.stopPropagation();done(selected);}};
    const key=e=>{if(e.key==="Escape"){e.stopPropagation();done(null);}};
    const teardown=Hooks.once("canvasTearDown",()=>done(null));
    canvas.stage.on("pointerdown",click);document.addEventListener("keydown",key);
  });
}
async function effect(actor,kind,{status,changes=[],extra={},description}={}) {
  const existing=actor.effects.filter(e=>e.getFlag(ID,"kind")===kind && kind!=="grapple");
  if(existing.length)await actor.deleteEmbeddedDocuments("ActiveEffect",existing.map(e=>e.id));
  const data={name:GENERIC_NAME[kind]??kind,img:`modules/${ID}/assets/${kind}.svg`,origin:actor.uuid,transfer:false,disabled:false,description:description??GENERICS[kind]?.description??"",changes,statuses:status?[status]:[],flags:{[ID]:{kind,turn:turnKey(game.combat),...extra}}};
  return (await actor.createEmbeddedDocuments("ActiveEffect",[data]))[0];
}
const GENERIC_NAME={dash:"Dash",disengage:"Disengage",hide:"Hidden",grapple:"Grappled"};
export async function clearHidden(actor) {const ids=actor.effects.filter(e=>e.getFlag(ID,"kind")==="hide").map(e=>e.id);if(ids.length)await actor.deleteEmbeddedDocuments("ActiveEffect",ids);}
async function post(ctx,content) {return ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:ctx.actor,token:ctx.token}),content:`<div class="bg3-chat">${content}</div>`});}

export async function generic(ctx,action) {
  if(!ctx.actor.isOwner)throw new Error("You do not own this character.");
  if(ctx.actor.statuses.has('incapacitated'))throw new Error("An incapacitated creature cannot take this action.");
  if(!canSpend(ctx,actionCost(ctx.actor,action)))throw new Error("That action is already spent. Right-click its resource to restore it.");
  if (["grapple","shove"].includes(action)) {
    const targets=[...game.user.targets];if(targets.length!==1)throw new Error("Target exactly one creature first.");
    const target=targets[0].document;targetValid(ctx.token,target);
    let destination=null,prone=false;
    if(action==="grapple" && !await confirm("Grapple",`<p>Confirm ${esc(ctx.actor.name)} has a free hand to grapple ${esc(target.name)}.</p>`,"Attempt grapple"))return;
    if(action==="shove") {
      const pick=await choose("Shove",`<p>On a failed save, how should ${esc(target.name)} be shoved?</p>`,[{value:"push",label:"Push 5 feet"},{value:"prone",label:"Knock prone"}]);
      if(!pick)return;prone=pick.button==="prone";
      if(!prone){destination=await chooseDestination(ctx.token,target);if(!destination)return;}
    }
    return requestGM({action,source:ctx.token.uuid,target:target.uuid,destination,prone});
  }
  return serial(`${ctx.document.uuid}:generic`,async()=>{
    if(action==="hide") {
      if(!await confirm("Hide", "<p>You must be out of enemy sight and heavily obscured, or behind three-quarters or total cover.</p><p>Confirm those requirements, then roll Stealth against DC 15.</p>","Roll Stealth"))return;
      const rolls=await ctx.actor.rollSkill({skill:"ste",target:15});if(!rolls?.length)return;
      await consume(ctx,actionCost(ctx.actor,action));
      if(rolls[0].total>=15)await effect(ctx.actor,"hide",{status:"invisible",extra:{dc:rolls[0].total}});
      await post(ctx,`<strong>Hide</strong> · ${rolls[0].total>=15?`Hidden. Discovery DC ${rolls[0].total}.`:"The attempt failed."}`);
    }else if(action==="dash") {
      const movement=ctx.actor.system.attributes.movement;
      const changes=Object.keys(CONFIG.DND5E.movementTypes).filter(k=>Number(movement[k])>0).map(k=>({key:`system.attributes.movement.${k}`,mode:CONST.ACTIVE_EFFECT_MODES.ADD,value:String(movement[k]),priority:30}));
      await consume(ctx,actionCost(ctx.actor,action));await effect(ctx.actor,"dash",{changes});
      await post(ctx,"<strong>Dash</strong> · Additional movement is available for this turn.");
    }else if(action==="disengage") {
      await consume(ctx,actionCost(ctx.actor,action));await effect(ctx.actor,"disengage",{changes:[{key:`flags.${ID}.disengaged`,mode:CONST.ACTIVE_EFFECT_MODES.OVERRIDE,value:"true",priority:20},{key:"flags.midi-qol.disengage",mode:CONST.ACTIVE_EFFECT_MODES.OVERRIDE,value:"true",priority:20}]});
      await post(ctx,"<strong>Disengage</strong> · Movement does not provoke Opportunity Attacks this turn.");
    }
  });
}
export async function requestGM(payload) {
  if(game.user.isGM)return executeRequest(payload,game.user);
  if(!game.users.activeGM)throw new Error("An active GM is needed to resolve this action against another creature or advance combat.");
  await ChatMessage.create({content:`<p>BG3 Combat Bar: ${esc(payload.action)} requested.</p>`,whisper:[game.users.activeGM.id,game.user.id],flags:{[ID]:{request:payload}}});
  ui.notifications.info("The GM is resolving the request.");
}
export async function executeRequest(payload,user) {
  if(!game.user.isGM)throw new Error("Only the GM resolves combat requests.");
  if(!["grapple","shove","endTurn","escape"].includes(payload.action))throw new Error("Invalid combat request.");
  const source=await getToken(payload.source),ctx=context(source);
  if(!source.actor.testUserPermission(user,"OWNER"))throw new Error("The requester does not own this character.");
  if(source.parent.id!==canvas.scene?.id)throw new Error("The GM must view the same scene to resolve the request.");
  return serial(`${source.uuid}:request`,async()=>{
    if(payload.action==="endTurn"){if(!isTurn(ctx))throw new Error("It is no longer this character's turn.");return game.combat.nextTurn();}
    if(payload.action==="escape")return escapeGrapple(ctx,payload.effect);
    const target=await getToken(payload.target);targetValid(source,target);
    const cost=actionCost(ctx.actor,payload.action);
    if(!canSpend(ctx,cost))throw new Error("No action or attack remains.");
    if(payload.action==="shove"&&!payload.prone&&!validDestination(source,target,payload.destination))throw new Error("That shove destination is no longer valid.");
    const modifier=Number(ctx.actor.getFlag(ID,"grappleAbility")==="dex"?ctx.actor.system.abilities.dex.mod:ctx.actor.system.abilities.str.mod);
    const unarmed=ctx.actor.items.find(i=>i.system?.identifier==='unarmed-strike'||/^unarmed strike$/i.test(i.name));
    const native=unarmed?.system.activities?.find(a=>a.name?.toLowerCase().includes(payload.action)&&Number.isFinite(a.save?.dc?.value));
    const dc=native?.save.dc.value??8+modifier+Number(ctx.actor.system.attributes.prof);
    const rolls=await rollDefense(target.actor,dc,payload.action);if(!rolls?.length)return;
    await consume(ctx,cost);
    const success=rolls[0].total<dc;
    if(success){
      if(payload.action==="grapple")await effect(target.actor,"grapple",{status:"grappled",extra:{source:source.uuid,target:target.uuid,dc},description:`Grappled by ${esc(source.name)}. Escape DC ${dc}.`});
      else if(payload.prone)await target.actor.toggleStatusEffect("prone",{active:true});
      else {
        targetValid(source,target);
        if(!validDestination(source,target,payload.destination))throw new Error("The shove succeeded, but its destination became blocked. The GM must resolve the movement.");
        const moved=await target.move({...payload.destination,action:"displace"},{constrainOptions:{ignoreCost:true}});
        if(!moved)ui.notifications.warn("The shove succeeded, but another rule or module stopped the movement.");
      }
    }
    await post(ctx,`<strong>${esc(GENERICS[payload.action].name)}</strong> · ${esc(target.name)} ${success?"fails":"passes"} the DC ${dc} save (${rolls[0].total}).`);
  });
}
async function rollDefense(actor,dc,action) {
  const owner=game.users.find(u=>u.active&&!u.isGM&&actor.testUserPermission(u,"OWNER"));
  const best=Number(actor.system.abilities.str.save?.value??actor.system.abilities.str.mod)>=Number(actor.system.abilities.dex.save?.value??actor.system.abilities.dex.mod)?"str":"dex";
  if(game.modules.get("midi-qol")?.active && globalThis.MidiQOL?.socket) {
    return MidiQOL.socket().executeAsUser("rollAbility",owner?.id??game.user.id,{
      saveDetails:{actorUuid:actor.uuid,rollType:"save",rollAbilities:owner?["str","dex"]:[best],rollSkills:[],rollTools:[],rollDC:dc,isMagicSave:false,isFriendly:false,saveItemUuid:"",workflowOptions:{},workflowId:"",itemCardUuid:"",itemId:""},
      displayOptions:{fastForward:!owner,chatMessage:true,showTargetDC:true}
    });
  }
  if(!actor.hasPlayerOwner)return actor.rollSavingThrow({ability:best,target:dc},{configure:false});
  const choice=await choose(`${actor.name}: resist ${action}`,`<p>DC ${dc}. The target chooses its saving throw.</p>`,[{value:"str",label:"Strength save"},{value:"dex",label:"Dexterity save"}]);
  if(!choice)return;
  return actor.rollSavingThrow({ability:choice.button,target:dc});
}
async function escapeGrapple(ctx,id) {
  const grapple=ctx.actor.effects.get(id);if(grapple?.getFlag(ID,"kind")!=="grapple")throw new Error("That grapple has ended.");
  if(!canSpend(ctx,"action"))throw new Error("No action remains to escape.");
  const pick=await choose("Escape grapple",`<p>Escape DC ${grapple.getFlag(ID,"dc")}</p>`,[{value:"ath",label:"Athletics"},{value:"acr",label:"Acrobatics"}]);
  if(!pick)return;const rolls=await ctx.actor.rollSkill({skill:pick.button,target:grapple.getFlag(ID,"dc")});if(!rolls?.length)return;
  await consume(ctx,"action");if(rolls[0].total>=grapple.getFlag(ID,"dc"))await grapple.delete();
}
export function registerRequests() {
  Hooks.on("createChatMessage",async message=>{
    const request=message.getFlag(ID,"request");if(!request||!activeGM())return;
    try {await executeRequest(request,message.author??game.users.get(message._source.user));await message.update({content:`${message.content}<p>Request resolved.</p>`,[`flags.${ID}.resolved`]:true});}
    catch(error){ui.notifications.warn(error.message);await message.update({content:`${message.content}<p>${esc(error.message)}</p>`});}
  });
}
export async function cleanupEffects() {
  return serial(`${ID}:cleanup`,cleanupEffectsNow);
}
async function cleanupEffectsNow() {
  if(!activeGM()||!canvas.ready)return;
  const actors=new Map([...game.actors,...canvas.tokens.placeables.map(t=>t.actor).filter(Boolean)].map(a=>[a.uuid,a]));
  for(const actor of actors.values()) {
    const remove=[];
    for(const e of actor.effects) {
      const kind=e.getFlag(ID,"kind");
      if(["dash","disengage"].includes(kind)&&e.getFlag(ID,"turn")!==turnKey(game.combat))remove.push(e.id);
      if(kind==="grapple") {
        const source=await fromUuid(e.getFlag(ID,"source")),target=await fromUuid(e.getFlag(ID,"target"));
        if(!source?.actor||!target?.actor||source.actor.statuses.has("incapacitated")||(source.parent.id===canvas.scene.id && (distance(source,target)>feet(5)+0.01||Math.abs(source.elevation-target.elevation)>feet(5))))remove.push(e.id);
      }
    }
    if(remove.length)await actor.deleteEmbeddedDocuments("ActiveEffect",remove);
  }
}
