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
export function sectionDefinitions(){
  return combineSections(globalThis.game?.settings?.get?.(ID,'defaultSections')??[],globalThis.game?.user?.getFlag?.(ID,'sections'));
}
export function visibleSectionOrder(data){
  const visible=new Set(['features','spells','items',...sectionDefinitions().filter(s=>s.visible).map(s=>s.id)]);
  return data.order.filter(id=>visible.has(id));
}
export function sectionName(id){return {features:'Features',spells:'Spells',items:'Items'}[id]??sectionDefinitions().find(s=>s.id===id)?.name??'Section';}

function managerOptions(shared){
  const defaults=normalizeSections(game.settings.get(ID,'defaultSections'));
  const personal=game.user.getFlag(ID,'sections')??{};
  const rows=normalizeSections(shared?defaults:personal.custom);
  const rowHTML=s=>`<div class="bg3-section-setting" data-section-id="${s.id}"><input name="section-name" aria-label="Section name" value="${esc(s.name)}" maxlength="40" required><label><input type="checkbox" name="section-visible" ${s.visible?'checked':''}>Show</label><button type="button" data-remove-section aria-label="Remove ${esc(s.name)}"><i class="fa-solid fa-trash" inert></i></button></div>`;
  return {window:{title:shared?'Default Sections':'Custom Sections'},position:{width:540},classes:['bg3-app','bg3-section-manager'],modal:true,rejectClose:false,
    content:`<p>${shared?'Create sections for everyone in this world. Turn off Show to keep a section ready for later.':'Create your own sections and choose which shared sections you see.'} Each section accepts items, spells, and features. Assignments stay with each character.</p>${!shared&&defaults.length?`<fieldset><legend>GM default sections</legend>${defaults.map(s=>`<label class="bg3-shared-visibility"><input type="checkbox" data-default-id="${s.id}" ${!personal.hiddenDefaults?.includes(s.id)?'checked':''}><span>${esc(s.name)}${!s.visible?' <small>Hidden by GM</small>':''}</span></label>`).join('')}</fieldset>`:''}<div data-section-settings>${rows.map(rowHTML).join('')}</div><button type="button" data-add-section><i class="fa-solid fa-plus" inert></i> Add Section</button>`,
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
    _onRender(context,options){super._onRender(context,options);this.bindSections(null,this);}
  }
  class DefaultSections extends SectionManager{constructor(options={}){super(true,options);}}
  class CustomSections extends SectionManager{constructor(options={}){super(false,options);}}
  game.settings.registerMenu(ID,'defaultSectionsMenu',{name:'Default Sections',label:'Default Sections',hint:'Create shared sections, or hide them until they are ready.',icon:'fa-solid fa-layer-group',type:DefaultSections,restricted:true});
  game.settings.registerMenu(ID,'customSectionsMenu',{name:'Custom Sections',label:'Custom Sections',hint:'Create personal sections and hide GM defaults for yourself.',icon:'fa-solid fa-table-cells',type:CustomSections,restricted:false});
  Hooks.on('updateUser',user=>{if(user.id===game.user.id)refresh();});
}
