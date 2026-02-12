import React, { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import Topbar from "./components/Topbar";
import BottomNav from "./components/BottomNav";
import ToastHost from "./components/ToastHost";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Cart from "./pages/Cart";
import Orders from "./pages/Orders";
import Categories from "./pages/Categories";
import Favorites from "./pages/Favorites";
import Admin from "./pages/Admin";

import { watchAuth, logout } from "./lib/authPhone";
import { ensureUserDoc } from "./lib/userService";
import { listenCart } from "./lib/shopService";

export default function App(){
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [cartCount, setCartCount] = useState(0);

  const [toasts, setToasts] = useState([]);
  const toast = (title, message) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [{id,title,message}, ...t].slice(0,3));
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)), 3500);
  };
  const closeToast = (id)=> setToasts(t=>t.filter(x=>x.id!==id));

  useEffect(()=>{
    const unsub = watchAuth(async (u)=>{
      setUser(u||null);
      setUserDoc(null);
      setCartCount(0);

      if(u){
        const d = await ensureUserDoc({ uid:u.uid, phone:u.phoneNumber||"", name:"" });
        setUserDoc(d);

        const unsubCart = listenCart(u.uid, (c)=>{
          const n = (c.items||[]).reduce((s,i)=>s+Number(i.qty||1),0);
          setCartCount(n);
        });
        return ()=> unsubCart && unsubCart();
      }
    });
    return ()=> unsub && unsub();
  },[]);

  async function onLogout(){
    await logout();
    toast("Chiqildi", "Tizimdan chiqdingiz.");
  }

  return (
    <>
      <Topbar search={search} setSearch={setSearch} user={user} userDoc={userDoc} onLogout={onLogout} />
      <Routes>
        <Route path="/" element={<Home user={user} search={search} toast={toast} />} />
        <Route path="/login" element={<Login toast={toast} />} />
        <Route path="/profile" element={<Profile user={user} userDoc={userDoc} toast={toast} />} />
        <Route path="/cart" element={<Cart user={user} userDoc={userDoc} toast={toast} />} />
        <Route path="/orders" element={<Orders user={user} />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/admin" element={<Admin user={user} toast={toast} />} />
        <Route path="*" element={<div className="container" style={{paddingBottom:110}}><div className="h1">Topilmadi</div></div>} />
      </Routes>
      <BottomNav cartCount={cartCount} />
      <ToastHost toasts={toasts} onClose={closeToast} />
    </>
  );
}
