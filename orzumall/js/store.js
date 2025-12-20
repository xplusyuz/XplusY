const PRODUCTS = [
  {id:1, title:"Telefon", price:1500000},
  {id:2, title:"Quloqchin", price:250000}
];

function getCart(){
  return JSON.parse(localStorage.getItem("cart")||"[]");
}
function saveCart(cart){
  localStorage.setItem("cart", JSON.stringify(cart));
}

function addToCart(p){
  const cart = getCart();
  cart.push(p);
  saveCart(cart);
  alert("🛒 Savatga qo‘shildi");
}

function renderProducts(){
  const box = document.getElementById("products");
  PRODUCTS.forEach(p=>{
    const d = document.createElement("div");
    d.className="card";
    d.innerHTML=`
      <b>${p.title}</b><br>
      💰 ${p.price.toLocaleString()} so‘m<br><br>
      <button onclick='addToCart(${JSON.stringify(p)})'>Savatga</button>
    `;
    box.appendChild(d);
  });
}
