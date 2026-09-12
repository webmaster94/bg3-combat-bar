export const ID = "bg3-combat-bar";
export const SECTIONS = { features: 12, spells: 12, items: 8 };
export const GENERICS = {
  dash: { name: "Dash", description: "Gain additional movement equal to your current speed for this turn.", cost: "action" },
  disengage: { name: "Disengage", description: "Your movement does not provoke Opportunity Attacks for the rest of this turn.", cost: "action" },
  hide: { name: "Hide", description: "While out of enemy sight and heavily obscured or behind sufficient cover, make a DC 15 Dexterity (Stealth) check. On success, become Invisible while hidden. The roll is the DC to find you. Attacking or casting a spell with a Verbal component ends hiding.", cost: "action" },
  grapple: { name: "Grapple", description: "Replace one attack. A creature within 5 feet, no more than one size larger, chooses a Strength or Dexterity save against 8 + your Strength modifier + proficiency. On failure, it is Grappled. You need a free hand. Use the target's condition control to escape or release.", cost: "attack" },
  shove: { name: "Shove", description: "Replace one attack. A creature within 5 feet, no more than one size larger, chooses a Strength or Dexterity save. On failure, knock it Prone or push it 5 feet away from you.", cost: "attack" }
};
export const clone = value => structuredClone(value);
export const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function newPage() { return Object.fromEntries(Object.entries(SECTIONS).map(([key, n]) => [key, Array(n).fill(null)])); }
export function defaultLayout() {
  return { version: 1, locked: false, page: 0, pages: [newPage()], order: ["weapons",...Object.keys(SECTIONS)], widths: {...SECTIONS},
    weapons: { melee: [[null,null],[null,null]], ranged: [[null,null],[null,null]] },
    weaponTab: "melee", weaponSet: {melee:0,ranged:0}, activeLoadout: null, resources: [], offset: {x:0,y:0} };
}
export function normalizeLayout(saved) {
  const base = defaultLayout();
  if (!saved || saved.version !== 1) return base;
  const result = {...base, ...clone(saved)};
  result.pages = (Array.isArray(saved.pages) && saved.pages.length ? saved.pages.slice(0,12) : [newPage()]).map(p =>
    Object.fromEntries(Object.entries(SECTIONS).map(([key,n]) => [key, Array.from({length:n}, (_,i) => typeof p?.[key]?.[i] === "string" ? p[key][i] : null)])));
  result.page = Math.max(0, Math.min(result.pages.length-1, Math.trunc(Number(saved.page) || 0)));
  result.widths = Object.fromEntries(Object.entries(SECTIONS).map(([key,max])=>[key,Math.max(4,Math.min(max,2*Math.round((Number(saved.widths?.[key])||max)/2)))]));
  result.order = [...new Set([...(saved.order ?? []).filter(k => k === "weapons" || k in SECTIONS), "weapons", ...Object.keys(SECTIONS)])];
  for (const type of ["melee","ranged"]) {
    result.weapons[type] = Array.from({length:2}, (_,i) => Array.from({length:2}, (_,j) => saved.weapons?.[type]?.[i]?.[j] ?? null));
  }
  return result;
}
export function matchesItem(item, section, hand=0) {
  if (!item) return false;
  if (section === "features") return item.type === "feat";
  if (section === "spells") return item.type === "spell";
  if (section === "items") return ["consumable","equipment","tool","loot","container"].includes(item.type);
  if (hand === 1 && item.type === "equipment" && item.system?.type?.value === "shield") return true;
  if (item.type !== "weapon") return false;
  const type = item.system?.type?.value ?? item.system?.weaponType ?? "";
  const ranged = ["simpleR","martialR","naturalR","siege"].includes(type);
  return section === "ranged" ? ranged : section === "melee" && !ranged;
}
export function usesBadge(item) {
  const uses = item?.system?.uses;
  const max = Number(uses?.max);
  if (max > 0) return `${uses.value ?? Math.max(0,max-Number(uses.spent || 0))}/${max}`;
  const activities = Array.from(item?.system?.activities ?? []);
  const limited = activities.find(a => Number(a.uses?.max) > 0);
  if (limited) return `${limited.uses.value ?? Math.max(0,Number(limited.uses.max)-Number(limited.uses.spent || 0))}/${limited.uses.max}`;
  if (item?.type === "consumable") return String(item.system.quantity ?? 0);
  return "";
}
export function turnKey(combat) { return combat?.started ? `${combat.id}:${combat.round}:${combat.turn}` : "outside"; }
export function freshEconomy(key) { return {key, action:1, bonus:1, attacks:0, attackAction:false, dash:0}; }
export function spendEconomy(state, cost, attacksPerAction=1) {
  const next = clone(state);
  if (cost === "attack") {
    if (next.attackAction && next.attacks > 0) next.attacks--;
    else if (next.action > 0) { next.action--; next.attackAction=true; next.attacks=Math.max(0,attacksPerAction-1); }
    else return null;
  } else if (["action","bonus"].includes(cost)) {
    if (next[cost] < 1) return null;
    next[cost]--;
  }
  return next;
}
export function sizeAllowed(source, target) {
  const sizes = ["tiny","sm","med","lg","huge","grg"];
  return sizes.indexOf(target) <= sizes.indexOf(source)+1;
}
export function isPushDestination(source, start, end, distance, tolerance=0.05) {
  const moved = Math.hypot(end.x-start.x,end.y-start.y);
  const before = Math.hypot(start.x-source.x,start.y-source.y);
  const after = Math.hypot(end.x-source.x,end.y-source.y);
  const dot = (end.x-start.x)*(start.x-source.x)+(end.y-start.y)*(start.y-source.y);
  return Math.abs(moved-distance) <= tolerance && after > before && dot > 0;
}
