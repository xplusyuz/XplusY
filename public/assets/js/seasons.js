// seasons.js — fasllar fon animatsiyasi (xatosiz)
export function initSeasonalBackground(){
  const m=new Date().getMonth()+1;
  let s='spring';
  if(m>=3 && m<=5) s='spring'; else if(m>=6 && m<=8) s='summer'; else if(m>=9 && m<=11) s='autumn'; else s='winter';
  document.documentElement.dataset.season=s;
  try{
    const layer=document.createElement('div');
    layer.className='season-layer';
    layer.setAttribute('aria-hidden','true');
    Object.assign(layer.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'0'});
    document.body.appendChild(layer);
  }catch(e){}
}
