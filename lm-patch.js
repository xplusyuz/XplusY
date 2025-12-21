(function(){
  function lockProfileModal(){
    const modal = document.querySelector('#profileModal, .profile-modal, [data-profile-modal], .modal.profile');
    if(!modal) return;
    function isComplete(){
      if(window.__LM_PROFILE_COMPLETED===true) return true;
      const ids=['firstName','lastName','birthDate','region','district','pfFirst','pfLast','pfBirth','pfRegion','pfDistrict'];
      let any=false, ok=true;
      ids.forEach(id=>{
        const el=modal.querySelector('#'+id);
        if(el){ any=true; if(!String(el.value||'').trim()) ok=false; }
      });
      if(any) return ok;
      const inputs=modal.querySelectorAll('input,select,textarea');
      if(inputs.length){
        inputs.forEach(el=>{
          const t=(el.getAttribute('type')||'').toLowerCase();
          if(t==='button'||t==='submit') return;
          if(el.disabled) return;
          if(!String(el.value||'').trim()) ok=false;
        });
        return ok;
      }
      return false;
    }
    function apply(){
      const complete=isComplete();
      modal.classList.toggle('lm-locked', !complete);
      modal.querySelectorAll('[data-close], .close, .modal-close, button[aria-label="close"], .x, .btn-close').forEach(btn=>{
        btn.style.pointerEvents = complete ? '' : 'none';
        btn.style.opacity = complete ? '' : '0';
      });
    }
    document.addEventListener('keydown',(e)=>{
      if(e.key==='Escape' && modal.classList.contains('lm-locked')){ e.preventDefault(); e.stopPropagation(); }
    }, true);
    modal.addEventListener('click',(e)=>{
      if(!modal.classList.contains('lm-locked')) return;
      const card = modal.querySelector('.modalCard, .card, .panel, .dialog, .sheet, .modal-content') || null;
      if(card && !card.contains(e.target)){ e.preventDefault(); e.stopPropagation(); }
    }, true);
    const obs=new MutationObserver(apply); obs.observe(modal,{subtree:true,childList:true,attributes:true});
    modal.addEventListener('input',apply,true); modal.addEventListener('change',apply,true);
    apply();
  }

  // Ranking response compat (items/users)
  const origFetch=window.fetch;
  window.fetch=async function(input, init){
    const res=await origFetch(input, init);
    try{
      const url=typeof input==='string'?input:(input&&input.url)||'';
      if(url.includes('/api/ranking')||url.includes('/api/rank')){
        const clone=res.clone(); const data=await clone.json();
        if(data && data.items && !data.users){
          data.users=data.items;
          return new Response(JSON.stringify(data), {status:res.status, headers:res.headers});
        }
      }
    }catch(_){}
    return res;
  };

  lockProfileModal();
  window.addEventListener('load', lockProfileModal);
})();