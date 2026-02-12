import React from 'react'
export default function ToastHost({toasts,onClose}){return (<div className='toastWrap'>{toasts.map(t=>(<div className='toast' key={t.id}><div><b>{t.title}</b><div style={{color:'var(--muted)',marginTop:4}}>{t.message}</div></div><button className='x' onClick={()=>onClose(t.id)} aria-label='Close'>×</button></div>))}</div>)}
