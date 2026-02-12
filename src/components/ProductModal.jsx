import React, { useMemo, useState } from "react";
import { moneyUZS } from "../lib/format";

export default function ProductModal({ product, onClose, onAdd }) {
  const colors = product?.variants?.colors || [];
  const sizes = product?.variants?.sizes || [];
  const [colorKey, setColorKey] = useState(colors[0]?.key || "");
  const [size, setSize] = useState(sizes[0] || "");
  const [qty, setQty] = useState(1);

  const img = useMemo(() => {
    const by = product?.imagesByColor || {};
    const fromColor = colorKey && by[colorKey]?.[0];
    const any = Object.values(by)[0]?.[0];
    return fromColor || any || product?.cover || product?.image || "";
  }, [product, colorKey]);

  if (!product) return null;

  return (
    <div className="modalBackdrop" onMouseDown={(e)=>{ if(e.target.classList.contains('modalBackdrop')) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modalHeader">
          <div className="title">{product.title}</div>
          <button className="btnGhost" onClick={onClose}>Yopish</button>
        </div>
        <div className="modalBody">
          <div className="kv">
            <div>
              {img ? <img className="kvImg" src={img} alt={product.title} /> : <div className="kvImg" />}
              <div className="pillRow">
                {colors.map(c => (
                  <button key={c.key} className={"pill"+(c.key===colorKey?" active":"")} onClick={()=>setColorKey(c.key)} type="button">
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="pillRow">
                {sizes.map(s => (
                  <button key={s} className={"pill"+(s===size?" active":"")} onClick={()=>setSize(s)} type="button">
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="panel" style={{padding:14}}>
                <div className="h2">Narx</div>
                <div className="priceRow">
                  <div className="price" style={{fontSize:22}}>{moneyUZS(product.price)}</div>
                  {product.oldPrice ? <div className="old">{moneyUZS(product.oldPrice)}</div> : null}
                </div>
                <div className="hr" />
                <div className="p">{(product.desc||"Tavsif yo‘q.").slice(0,600)}</div>
                <div className="row" style={{alignItems:'center'}}>
                  <div>
                    <div style={{color:'var(--muted)',fontWeight:800,marginBottom:6}}>Soni</div>
                    <input className="input" type="number" min="1" value={qty} onChange={(e)=>setQty(Math.max(1, Number(e.target.value||1)))} />
                  </div>
                  <div style={{minWidth:180}}>
                    <div style={{color:'var(--muted)',fontWeight:800,marginBottom:6}}>Variant</div>
                    <div style={{fontWeight:950}}>{colorKey||'-'} / {size||'-'}</div>
                  </div>
                </div>
                <div className="hr" />
                <div className="row">
                  <button className="btn" type="button" onClick={()=>onAdd({product,colorKey,size,qty})}>Savatga qo‘shish</button>
                  <button className="btnGhost" type="button" onClick={onClose}>Keyin</button>
                </div>
              </div>
            </div>
          </div>
          <div style={{height:22}} />
        </div>
      </div>
    </div>
  );
}
