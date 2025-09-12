export function $(q, el=document){ return el.querySelector(q); }
export function $all(q, el=document){ return Array.from(el.querySelectorAll(q)); }

export function modal({title, body, okText="OK", cancelText="Bekor qilish"} = {}){
  return new Promise((resolve)=>{
    const mb = document.getElementById('modal-backdrop');
    const m = document.getElementById('modal');
    document.getElementById('modal-title').textContent = title||"Xabar";
    document.getElementById('modal-body').innerHTML = body||"";
    const ok = document.getElementById('modal-ok');
    const cc = document.getElementById('modal-cancel');
    ok.textContent = okText; cc.textContent = cancelText;
    const close = (v)=>{ m.classList.add('hidden'); mb.classList.add('hidden'); ok.onclick=null; cc.onclick=null; resolve(v); };
    ok.onclick=()=>close(true); cc.onclick=()=>close(false);
    mb.classList.remove('hidden'); m.classList.remove('hidden');
  });
}

export function currency(v){ return (v||0).toLocaleString('uz-UZ') + " so'm"; }
export function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
export function renderMath(){ if(window.MathJax && window.MathJax.typesetPromise){ return window.MathJax.typesetPromise(); } }
