export const $ = id => document.getElementById(id);
export const uid = () => crypto.randomUUID();
export const today = () => new Date().toISOString().slice(0,10);
export const number = v => new Intl.NumberFormat('es-MX').format(Number(v)||0);
export const money = (v,c='USD') => new Intl.NumberFormat('es-MX',{style:'currency',currency:c||'USD',maximumFractionDigits:2}).format(Number(v)||0);
export const percent = v => `${(Number(v)||0).toFixed(2)}%`;
export const esc = (v='') => String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
export function toast(msg){const e=$('toast');if(!e)return;e.textContent=msg;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2400)}
export const dispositionLabel = v => ({scrap:'Scrap',rework:'Retrabajo',repair:'Reparación',use_as_is:'Uso como está',supplier_return:'Devuelto a proveedor',pending:'Pendiente'}[v]||v);
