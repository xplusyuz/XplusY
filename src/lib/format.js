export function moneyUZS(n){const v=Number(n||0);return new Intl.NumberFormat('uz-UZ').format(v)+' so\'m'}
export function phoneUzNormalize(raw){
  let s=String(raw||'').replace(/\s+/g,''); s=s.replace(/(?!^)\+/g,''); s=s.replace(/[^\d+]/g,'');
  if(s.startsWith('00')) s='+'+s.slice(2);
  if(!s.startsWith('+')) s='+'+s;
  if(s==='+') s='+998';
  if(s.startsWith('+998')) s=s.slice(0,13);
  return s;
}
