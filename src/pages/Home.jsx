import React, { useEffect, useState } from "react";
import ProductCard from "../components/ProductCard";
import ProductModal from "../components/ProductModal";
import { listenProducts, addToCart } from "../lib/shopService";

export default function Home({ user, search, toast }) {
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    const unsub = listenProducts({ search }, setProducts);
    return () => unsub && unsub();
  }, [search]);

  async function onAdd({ product, colorKey, size, qty }) {
    if (!user) {
      toast("Kirish kerak", "Savatga qo‘shish uchun avval tizimga kiring.");
      return;
    }
    await addToCart(user.uid, {
      productId: product.id,
      title: product.title,
      price: product.price,
      qty,
      colorKey,
      size,
      image: (product.imagesByColor?.[colorKey]?.[0]) || Object.values(product.imagesByColor || {})[0]?.[0] || product.cover || ""
    });
    toast("Savatga qo‘shildi", `${product.title} (${colorKey || "-"}, ${size || "-"})`);
    setOpen(null);
  }

  return (
    <div className="container" style={{ paddingBottom: 110 }}>
      <div className="h1">Mahsulotlar</div>
      <div className="p">Premium OrzuMall 2.0 — tez, toza, professional.</div>

      <div className="grid">
        {products.map(p => <ProductCard key={p.id} p={p} onOpen={(x)=>setOpen(x)} />)}
      </div>

      {open ? <ProductModal product={open} onClose={()=>setOpen(null)} onAdd={onAdd} /> : null}
    </div>
  );
}
