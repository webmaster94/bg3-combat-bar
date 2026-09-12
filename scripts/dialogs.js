import {escapeHTML as esc} from "./model.js";

export function choose(title, content, buttons, {width=440}={}) {
  return foundry.applications.api.DialogV2.wait({
    window:{title},position:{width},classes:['bg3-app'],modal:true,rejectClose:false,
    content,
    buttons:buttons.map(b=>({action:b.value,label:b.label,callback:(_event,button)=>({button:b.value,data:new FormData(button.form)})}))
  });
}
export async function confirm(title,content,label="Continue") { return !!await choose(title,content,[{value:"yes",label}]); }
export function showPanel(title,content,render,{width=550}={}) {
  return foundry.applications.api.DialogV2.wait({window:{title},position:{width},classes:['bg3-app'],content,modal:true,rejectClose:false,buttons:[{action:'close',label:'Close'}],render:(_event,app)=>render(app)});
}
export async function pickItem(ctx, title, predicate, {allowClear=true,emptyText='No matching items on this character.'}={}) {
  const items=ctx.actor.items.filter(predicate).sort((a,b)=>a.name.localeCompare(b.name));
  let selected;
  await foundry.applications.api.DialogV2.wait({
    window:{title},position:{width:460},classes:['bg3-app','bg3-picker'],modal:true,rejectClose:false,
    content:`<input type="search" placeholder="Search this character…" aria-label="Search items"><div class="bg3-item-list">${items.map(i=>`<button type="button" data-item-id="${i.id}"><img src="${esc(i.img)}" alt=""><span>${esc(i.name)}</span><small>${esc(i.type==='feat'?'Feature':i.type[0].toUpperCase()+i.type.slice(1))}</small></button>`).join('')||`<p>${esc(emptyText)}</p>`}</div>`,
    buttons:[...(allowClear?[{action:'clear',label:'Clear slot',callback:()=>{selected=null;}}]:[]),{action:'cancel',label:'Cancel'}],
    render:(_event,app)=>{
      const root=app.element;
      root.querySelector('input').oninput=e=>root.querySelectorAll('[data-item-id]').forEach(b=>b.hidden=!b.textContent.toLowerCase().includes(e.target.value.toLowerCase()));
      root.querySelectorAll('[data-item-id]').forEach(b=>b.onclick=()=>{selected=b.dataset.itemId;app.close();});
    }
  });
  return selected;
}
