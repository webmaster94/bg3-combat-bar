import {escapeHTML as esc} from "./model.js";
export function choose(title, content, buttons, {width=440}={}) {
  return new Promise(resolve => {
    const dialog=document.createElement("dialog"); dialog.className="bg3-dialog"; dialog.style.width=`${width}px`;
    dialog.innerHTML=`<header><h2>${esc(title)}</h2><button type="button" data-cancel aria-label="Close">×</button></header><form><div class="bg3-dialog-body">${content}</div><footer>${buttons.map(b=>`<button type="submit" value="${esc(b.value)}">${esc(b.label)}</button>`).join("")}</footer></form>`;
    let settled=false;
    const finish=result=> {if(settled)return;settled=true;dialog.close();dialog.remove();resolve(result);};
    dialog.querySelector("form").onsubmit=e=> {e.preventDefault();finish({button:e.submitter?.value,data:new FormData(e.currentTarget)});};
    dialog.querySelector("[data-cancel]").onclick=()=>finish(null);
    dialog.addEventListener("cancel",e=>{e.preventDefault();finish(null);});
    document.body.append(dialog);dialog.showModal();
  });
}
export async function confirm(title,content,label="Continue") { return !!await choose(title,content,[{value:"yes",label}]); }
export async function pickItem(ctx, section, predicate) {
  const items=ctx.actor.items.filter(predicate).sort((a,b)=>a.name.localeCompare(b.name));
  const dialog=document.createElement("dialog");dialog.className="bg3-dialog bg3-picker";
  dialog.innerHTML=`<header><h2>${esc(section)}</h2><button data-close aria-label="Close">×</button></header><input type="search" placeholder="Search this character…" aria-label="Search items"><div class="bg3-item-list">${items.map(i=>`<button data-id="${i.id}"><img src="${esc(i.img)}" alt=""><span>${esc(i.name)}</span><small>${esc(i.type)}</small></button>`).join("") || "<p>No matching items on this character.</p>"}</div><footer><button data-clear>Clear slot</button></footer>`;
  return new Promise(resolve=>{
    const done=value=>{dialog.close();dialog.remove();resolve(value);};
    dialog.querySelector("[data-close]").onclick=()=>done(undefined);
    dialog.querySelector("[data-clear]").onclick=()=>done(null);
    dialog.oncancel=e=>{e.preventDefault();done(undefined);};
    dialog.querySelector("input").oninput=e=>dialog.querySelectorAll("[data-id]").forEach(b=>b.hidden=!b.textContent.toLowerCase().includes(e.target.value.toLowerCase()));
    dialog.querySelectorAll("[data-id]").forEach(b=>b.onclick=()=>done(b.dataset.id));
    document.body.append(dialog);dialog.showModal();
  });
}
