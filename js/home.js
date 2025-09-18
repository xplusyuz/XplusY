import { fetchCSV } from './csv.js';

export async function onMount(){
  const list = await fetchCSV('csv/home.csv').catch(()=>[]);
  const grid = document.getElementById('homeGrid');
  grid.innerHTML = list.map(item=>`
    <a class="item" href="${item.link||'#'}">
      <img src="${item.img}" alt="">
      <div class="meta">
        <div class="title">${item.title}</div>
        <div class="sub">${item.meta}</div>
      </div>
    </a>
  `).join('');

  const news = document.getElementById('newsList');
  const sample = [
    "Yangi Algebra kursi yo‘lga qo‘yildi",
    "Haftalik Live musobaqasi yakshanba kuni 19:00",
    "Top 100 reyting yangilandi"
  ];
  news.innerHTML = sample.map(x=> `<li>${x}</li>`).join('');
}
