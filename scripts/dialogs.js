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
export {pickItem} from './picker.js';
