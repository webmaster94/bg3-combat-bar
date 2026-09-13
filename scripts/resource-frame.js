// One outline encloses both tiers. There is deliberately no edge between the two rows.
export function resourceFrame(width,height,upperWidth=0,upperHeight=0){
  const w=width+10,h=height+upperHeight+10;
  const outline=inset=>{
    const l=5+inset,r=w-5-inset,b=h-5-inset,y=5+upperHeight+inset;
    const capL=(w-upperWidth)/2+inset,capR=(w+upperWidth)/2-inset,t=5+inset;
    let path=`M ${l+15} ${b} L ${l+3} ${b+2} Q ${l+7} ${b-8} ${l} ${b-13} V ${y+15} Q ${l+9} ${y+11} ${l+4} ${y+1} L ${l+16} ${y+5}`;
    if(upperHeight>0)path+=` H ${capL} V ${t+15} Q ${capL+9} ${t+11} ${capL+4} ${t+1} L ${capL+16} ${t+5} H ${capR-16} L ${capR-4} ${t+1} Q ${capR-9} ${t+11} ${capR} ${t+15} V ${y+5}`;
    path+=` H ${r-16} L ${r-4} ${y+1} Q ${r-9} ${y+11} ${r} ${y+15} V ${b-13} Q ${r-7} ${b-8} ${r-3} ${b+2} L ${r-15} ${b} Z`;
    return path;
  };
  const curl=(x,y,flip=1)=>`<g transform="translate(${x} ${y}) scale(${flip} 1)" fill="none" stroke="#dfc48b" stroke-width="1"><path d="M4 1Q-3 11 7 18Q16 20 17 12Q17 7 12 9Q9 12 14 13M1 23Q11 18 12 26Q10 32 6 27"/><path d="m17 3 4 4-4 5-4-5Z" fill="#263027" stroke="#b49656"/></g>`;
  const baseY=5+upperHeight;
  return `<svg class="bg3-resource-outline" aria-hidden="true" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="top:${-upperHeight-5}px;left:-5px"><defs><linearGradient id="bg3-frame-gold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f0d69a"/><stop offset=".36" stop-color="#866536"/><stop offset=".7" stop-color="#b19150"/><stop offset="1" stop-color="#dbc085"/></linearGradient><linearGradient id="bg3-frame-ink" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#2b3028"/><stop offset=".4" stop-color="#192321"/><stop offset="1" stop-color="#111b1c"/></linearGradient></defs><path d="${outline(0)}" fill="url(#bg3-frame-ink)" stroke="#261e12" stroke-width="5"/><path d="${outline(0)}" fill="none" stroke="url(#bg3-frame-gold)" stroke-width="1.8"/><path d="${outline(3)}" fill="none" stroke="#ab8b4e" stroke-width=".7"/>${curl(5,baseY)}${curl(w-5,baseY,-1)}${upperHeight>0?curl((w-upperWidth)/2,5)+curl((w+upperWidth)/2,5,-1):''}</svg>`;
}
