import {ID,isCustomSection,escapeHTML as esc} from './model.js';

export function normalizeSections(entries=[]){
  const seen=new Set();
  return (Array.isArray(entries)?entries:[]).filter(s=>isCustomSection(s?.id)&&!seen.has(s.id)&&seen.add(s.id)).map(s=>({id:s.id,name:String(s.name??'Section').trim().slice(0,40)||'Section',visible:s.visible!==false}));
}
export function combineSections(defaults,personal){
  const hidden=new Set(personal?.hiddenDefaults??[]),shared=normalizeSections(defaults);
  const ids=new Set(shared.map(s=>s.id));
  return [...shared.map(s=>({...s,visible:s.visible&&!hidden.has(s.id),shared:true})),...normalizeSections(personal?.custom).filter(s=>!ids.has(s.id)).map(s=>({...s,shared:false}))];
}
export function sectionDefinitions(ctx){
  const global=combineSections(globalThis.game?.settings?.get?.(ID,'defaultSections')??[],globalThis.game?.user?.getFlag?.(ID,'sections'));
  const local=ctx?.document?.getFlag?.(ID,'characterSections')??{};
  const ids=new Set(global.map(s=>s.id));
  return [...global.map(s=>({...s,visible:s.visible&&!local.hiddenGlobal?.includes(s.id)})),...normalizeSections(local.custom).filter(s=>!ids.has(s.id)).map(s=>({...s,character:true}))];
}
export function visibleSectionOrder(data,ctx){
  const visible=new Set(['features','spells','items',...sectionDefinitions(ctx).filter(s=>s.visible).map(s=>s.id)]);
  return data.order.filter(id=>visible.has(id));
}
export function sectionName(id,ctx){return {features:'Features',spells:'Spells',items:'Items'}[id]??sectionDefinitions(ctx).find(s=>s.id===id)?.name??'Section';}

export async function hideSection(id,ctx){
  const section=sectionDefinitions(ctx).find(s=>s.id===id);if(!section)return;
  if(ctx){
    const local=foundry.utils.deepClone(ctx.document.getFlag(ID,'characterSections')??{});
    if(section.character)local.custom=normalizeSections(local.custom).map(s=>s.id===id?{...s,visible:false}:s);
    else local.hiddenGlobal=[...new Set([...(local.hiddenGlobal??[]),id])];
    return ctx.document.setFlag(ID,'characterSections',local);
  }
  const personal=foundry.utils.deepClone(game.user.getFlag(ID,'sections')??{});
  if(section.shared)personal.hiddenDefaults=[...new Set([...(personal.hiddenDefaults??[]),id])];
  else personal.custom=normalizeSections(personal.custom).map(s=>s.id===id?{...s,visible:false}:s);
  await game.user.setFlag(ID,'sections',personal);
}
export function editSection(id,ctx){
  const section=sectionDefinitions(ctx).find(s=>s.id===id);if(!section)return;
  if(section.character)return characterPreferences(ctx,{focusSection:id});
  const key=section.shared&&game.user.isGM?'defaultSectionsMenu':'customSectionsMenu';
  const Manager=game.settings.menus.get(`${ID}.${key}`).type;
  const app=new Manager();app.focusSection=id;return app.render(true);
}

export function characterPreferences(ctx,{editSlots,focusSection}={}){
  const local=ctx.document.getFlag(ID,'characterSections')??{},globals=sectionDefinitions();
  const row=s=>`<div class="bg3-section-setting" data-character-section="${s.id}"><input name="section-name" aria-label="Section name" value="${esc(s.name)}" maxlength="40" required><label><input name="section-visible" type="checkbox" ${s.visible?'checked':''}>Show</label><button type="button" data-remove-section aria-label="Remove ${esc(s.name)}"><i class="fa-solid fa-trash" inert></i></button></div>`;
  const save=async button=>{
    if(!ctx.actor.isOwner)throw Error('You do not own this character.');
    const form=button.form;
    await ctx.document.setFlag(ID,'characterSections',{custom:normalizeSections(Array.from(form.querySelectorAll('[data-character-section]'),el=>({id:el.dataset.characterSection,name:el.querySelector('[name="section-name"]').value,visible:el.querySelector('[name="section-visible"]').checked}))),hiddenGlobal:Array.from(form.querySelectorAll('[data-global-section]:not(:checked)'),el=>el.dataset.globalSection)});
  };
  return foundry.applications.api.DialogV2.wait({window:{title:`Preferences · ${ctx.actor.name}`},classes:['bg3-app','bg3-section-manager'],position:{width:550},modal:true,rejectClose:false,
    content:`<p>These sections belong to this character${ctx.token?.actorLink?'':' or unlinked token'}. Global sections in Configure Settings remain available to every character.</p>${globals.length?`<fieldset><legend>Global sections on this character</legend>${globals.map(s=>`<label class="bg3-shared-visibility"><input type="checkbox" data-global-section="${s.id}" ${!local.hiddenGlobal?.includes(s.id)?'checked':''}>${esc(s.name)}${!s.visible?' (hidden globally)':''}</label>`).join('')}</fieldset>`:''}<div data-character-sections>${normalizeSections(local.custom).map(row).join('')}</div><button type="button" data-add-character-section><i class="fa-solid fa-plus" inert></i> Add Character Section</button>${editSlots?'<hr><p><strong>Edit slots:</strong> click red slots to select them in green, then right-click to group, send to a page, or remove. Groups use rectangular blocks within a section. Drag an icon to move its group or selection. Drop outside the bar to remove assignments.</p>':''}`,
    buttons:[{action:'save',label:'Save Preferences',callback:(_e,b)=>save(b)},...(editSlots?[{action:'edit',label:'Save & Edit Slots',callback:async(_e,b)=>{await save(b);editSlots();}}]:[]),{action:'cancel',label:'Cancel'}],
    render:(_e,app)=>{
      const list=app.element.querySelector('[data-character-sections]');
      const bind=()=>list.querySelectorAll('[data-remove-section]').forEach(b=>b.onclick=()=>b.closest('[data-character-section]').remove());bind();
      app.element.querySelector('[data-add-character-section]').onclick=()=>{list.insertAdjacentHTML('beforeend',row({id:`custom-character-${foundry.utils.randomID()}`,name:'New Section',visible:true}));bind();list.lastElementChild.querySelector('input').focus();};
      if(focusSection)list.querySelector(`[data-character-section="${focusSection}"] input`)?.focus();
    }});
}

function managerOptions(shared){
  const defaults=normalizeSections(game.settings.get(ID,'defaultSections'));
  const personal=game.user.getFlag(ID,'sections')??{};
  const rows=normalizeSections(shared?defaults:personal.custom);
  const rowHTML=s=>`<div class="bg3-section-setting" data-section-id="${s.id}"><input name="section-name" aria-label="Section name" value="${esc(s.name)}" maxlength="40" required><label><input type="checkbox" name="section-visible" ${s.visible?'checked':''}>Show</label><button type="button" data-remove-section aria-label="Remove ${esc(s.name)}"><i class="fa-solid fa-trash" inert></i></button></div>`;
  return {window:{title:shared?'Global Default Sections':'Global Custom Sections'},position:{width:540},classes:['bg3-app','bg3-section-manager'],modal:true,rejectClose:false,
    content:`<p>${shared?'Create sections for everyone in this world. Turn off Show to keep a section ready for later.':'Create your own global sections for every character and choose which shared sections you see.'} Each section accepts items, spells, and features. Assignments stay with each character.</p>${!shared&&defaults.length?`<fieldset><legend>GM default sections</legend>${defaults.map(s=>`<label class="bg3-shared-visibility"><input type="checkbox" data-default-id="${s.id}" ${!personal.hiddenDefaults?.includes(s.id)?'checked':''}><span>${esc(s.name)}${!s.visible?' <small>Hidden by GM</small>':''}</span></label>`).join('')}</fieldset>`:''}<div data-section-settings>${rows.map(rowHTML).join('')}</div><button type="button" data-add-section><i class="fa-solid fa-plus" inert></i> Add Section</button>`,
    buttons:[{action:'save',label:'Save Sections',callback:async(_event,button)=>{
      if(shared&&!game.user.isGM)throw Error('Only a GM can change default sections.');
      const form=button.form;
      const sections=normalizeSections(Array.from(form.querySelectorAll('[data-section-id]'),row=>({id:row.dataset.sectionId,name:row.querySelector('[name="section-name"]').value,visible:row.querySelector('[name="section-visible"]').checked})));
      if(shared)await game.settings.set(ID,'defaultSections',sections);
      else await game.user.setFlag(ID,'sections',{custom:sections,hiddenDefaults:Array.from(form.querySelectorAll('[data-default-id]:not(:checked)'),el=>el.dataset.defaultId)});
    }},{action:'cancel',label:'Cancel'}],
    render:(_event,app)=>{
      const root=app.element,list=root.querySelector('[data-section-settings]');
      const bind=()=>list.querySelectorAll('[data-remove-section]').forEach(b=>b.onclick=()=>b.closest('[data-section-id]').remove());
      bind();root.querySelector('[data-add-section]').onclick=()=>{
        const id=`custom-${shared?'world':game.user.id}-${foundry.utils.randomID()}`;
        list.insertAdjacentHTML('beforeend',rowHTML({id,name:'New Section',visible:true}));bind();list.lastElementChild.querySelector('input').focus();
      };
    }};
}
export function registerSectionSettings(refresh){
  game.settings.register(ID,'defaultSections',{scope:'world',config:false,type:Array,default:[],requiresReload:false,onChange:refresh});
  const Dialog=foundry.applications.api.DialogV2;
  class SectionManager extends Dialog{
    constructor(shared,options={}){const config=managerOptions(shared);super({...config,...options});this.bindSections=config.render;}
    _onRender(context,options){super._onRender(context,options);this.bindSections(null,this);if(this.focusSection){const row=this.element.querySelector(`[data-section-id="${this.focusSection}"], [data-default-id="${this.focusSection}"]`);row?.scrollIntoView({block:'nearest'});const input=row?.matches('input')?row:row?.querySelector('input');input?.focus();if(input?.type==='text')input.select();}}
  }
  class DefaultSections extends SectionManager{constructor(options={}){super(true,options);}}
  class CustomSections extends SectionManager{constructor(options={}){super(false,options);}}
  game.settings.registerMenu(ID,'defaultSectionsMenu',{name:'Global Default Sections',label:'Global Default Sections',hint:'Create shared sections, or hide them until they are ready.',icon:'fa-solid fa-layer-group',type:DefaultSections,restricted:true});
  game.settings.registerMenu(ID,'customSectionsMenu',{name:'Global Custom Sections',label:'Global Custom Sections',hint:'Create global personal sections for all your characters. Character-specific sections are in the bar Preferences.',icon:'fa-solid fa-table-cells',type:CustomSections,restricted:false});
  Hooks.on('updateUser',user=>{if(user.id===game.user.id)refresh();});
}
