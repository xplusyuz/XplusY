import { createTopUpRequest } from '../common.js';
export async function mount(){
  const drop = document.getElementById('drop');
  const inp = document.getElementById('fileInp');
  const amountInp = document.getElementById('amountInp');
  const methodSel = document.getElementById('methodSel');
  const btn = document.getElementById('btnSendTopup');
  const msg = document.getElementById('topupMsg');

  drop.addEventListener('click', ()=> inp.click());
  drop.addEventListener('dragover', (e)=>{ e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', ()=> drop.classList.remove('drag'));
  drop.addEventListener('drop', (e)=>{ e.preventDefault(); drop.classList.remove('drag'); inp.files = e.dataTransfer.files; });

  btn.onclick = async () => {
    msg.textContent = 'Yuborilmoqda...';
    try{
      const file = inp.files?.[0] || null;
      const amount = Number(amountInp.value);
      const method = methodSel.value;
      const id = await createTopUpRequest({ amount, method, file });
      msg.textContent = 'Yuborildi! ID: '+id+' — Admin tasdiqlashini kuting.';
    }catch(e){
      msg.textContent = e.message;
    }
  };
}
