
export const $ = (q, el=document)=>el.querySelector(q);
export const $$ = (q, el=document)=>Array.from(el.querySelectorAll(q));

export function renderMath(){ if(window.MathJax && window.MathJax.typesetPromise){ return window.MathJax.typesetPromise(); } }

export function showModal({title="Xabar", body="", okText="OK", cancelText="Bekor qilish"}={}){
  return new Promise((resolve)=>{
    const mb = document.getElementById('modal-backdrop');
    const m = document.getElementById('modal');
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = body;
    const ok = $('#modal-ok'); const cc = $('#modal-cancel');
    ok.textContent = okText; cc.textContent = cancelText;
    const close=(v)=>{ m.classList.add('hidden'); mb.classList.add('hidden'); ok.onclick=null; cc.onclick=null; resolve(v); };
    ok.onclick=()=>close(true); cc.onclick=()=>close(false);
    mb.classList.remove('hidden'); m.classList.remove('hidden');
  });
}

export const money = (v)=> (Number(v||0)).toLocaleString('uz-UZ') + " so'm";
