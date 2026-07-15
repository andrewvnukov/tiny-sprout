'use strict';
// ============================================================
// ui.js — DOM-интерфейс: HUD, панели, туториал, модалки
// SVG-иконки: цветные мини-иллюстрации, без жёстких контуров
// ============================================================

const ICONS = {
// --- культуры ---
wheat:`<svg viewBox="0 0 24 24"><path d="M12 22V6" stroke="#c09455" stroke-width="1.7" stroke-linecap="round" fill="none"/><ellipse cx="12" cy="4.6" rx="2" ry="3" fill="#ecc463"/><ellipse cx="8.7" cy="9" rx="1.8" ry="2.7" fill="#ecc463" transform="rotate(-32 8.7 9)"/><ellipse cx="15.3" cy="9" rx="1.8" ry="2.7" fill="#e0b350" transform="rotate(32 15.3 9)"/><ellipse cx="8.7" cy="13.4" rx="1.8" ry="2.7" fill="#e0b350" transform="rotate(-32 8.7 13.4)"/><ellipse cx="15.3" cy="13.4" rx="1.8" ry="2.7" fill="#d5a63f" transform="rotate(32 15.3 13.4)"/><circle cx="11.2" cy="3.6" r=".9" fill="#f8e3a5"/></svg>`,
carrot:`<svg viewBox="0 0 24 24"><ellipse cx="9.5" cy="4.6" rx="2.6" ry="1.5" fill="#8fbf62" transform="rotate(-28 9.5 4.6)"/><ellipse cx="14.5" cy="4.6" rx="2.6" ry="1.5" fill="#a9d07c" transform="rotate(28 14.5 4.6)"/><path d="M12 22.2C9.8 18.2 8.3 12.6 8.3 9.6c0-2.2 1.6-3.6 3.7-3.6s3.7 1.4 3.7 3.6c0 3-1.5 8.6-3.7 12.6Z" fill="#ef8d45"/><path d="M12 22.2c-1-1.9-1.9-4.2-2.6-6.5l4.4-.6c-.5 2.5-1.1 5-1.8 7.1Z" fill="#dd7433"/><ellipse cx="10.6" cy="9.4" rx=".9" ry="2.1" fill="#f8b077" transform="rotate(8 10.6 9.4)"/></svg>`,
potato:`<svg viewBox="0 0 24 24"><ellipse cx="12" cy="13" rx="8.2" ry="6.4" fill="#c99e63" transform="rotate(-14 12 13)"/><ellipse cx="12.6" cy="12" rx="7" ry="5" fill="#d9b478" transform="rotate(-14 12.6 12)"/><circle cx="9" cy="11" r=".8" fill="#b28a52"/><circle cx="14.6" cy="14.4" r=".8" fill="#b28a52"/><circle cx="15.8" cy="9.8" r=".7" fill="#b28a52"/><ellipse cx="9.6" cy="9" rx="1.9" ry="1" fill="#ecd0a0" transform="rotate(-18 9.6 9)"/></svg>`,
cabbage:`<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8" fill="#79b268"/><path d="M12 5a8 8 0 0 1 8 8c0 1.6-.5 3-1.3 4.3C17.5 13 15.3 9.2 12 5Z" fill="#639b53"/><ellipse cx="12" cy="13.6" rx="4.6" ry="5.4" fill="#a5cf8b"/><path d="M12 8.2c1.8 1.8 2.9 3.7 2.9 5.4 0 1.8-1.1 3.8-2.9 5.4-1.8-1.6-2.9-3.6-2.9-5.4 0-1.7 1.1-3.6 2.9-5.4Z" fill="#c4e2a9"/><ellipse cx="8.4" cy="8.6" rx="2" ry="1.2" fill="#b8dc9c" transform="rotate(-30 8.4 8.6)"/></svg>`,
tomato:`<svg viewBox="0 0 24 24"><circle cx="12" cy="13.4" r="7.8" fill="#e8563f"/><path d="M4.5 15a7.8 7.8 0 0 0 15 0c-2.4 1.6-5 2.4-7.5 2.4S6.9 16.6 4.5 15Z" fill="#cf4530"/><ellipse cx="9" cy="10.4" rx="2.3" ry="1.5" fill="#f4917c" transform="rotate(-24 9 10.4)"/><path d="M12 3.6c.5 1.2.4 2 .4 2s1.7-1 3.2-.3c-1.2.9-1.6 1.7-1.6 1.7s2 .2 2.8 1.5c-1.6.4-4.8.6-4.8.6s-3.2-.2-4.8-.6c.8-1.3 2.8-1.5 2.8-1.5s-.4-.8-1.6-1.7c1.5-.7 3.2.3 3.2.3s-.1-.8.4-2Z" fill="#6ba455"/></svg>`,
cuke:`<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12.5" rx="10" ry="3.6" fill="#5f9e4e" transform="rotate(-38 12 12.5)"/><ellipse cx="12.6" cy="11.8" rx="8.2" ry="2.4" fill="#79b465" transform="rotate(-38 12.6 11.8)"/><ellipse cx="14.8" cy="9" rx="4" ry="1" fill="#a3cf8c" transform="rotate(-38 14.8 9)"/><circle cx="5.6" cy="18.4" r="1.1" fill="#4e8a3f"/></svg>`,
corn:`<svg viewBox="0 0 24 24"><path d="M7 14c-2.4-1-3.6-4-3.2-7 2.9.2 5 1.8 5.8 4.2Z" fill="#8fbf62"/><path d="M17 14c2.4-1 3.6-4 3.2-7-2.9.2-5 1.8-5.8 4.2Z" fill="#79ab52"/><ellipse cx="12" cy="12.6" rx="4.6" ry="8.4" fill="#f0c04c"/><path d="M12 4.2c2.5 0 4.6 3.8 4.6 8.4S14.5 21 12 21Z" fill="#dfa93a"/><circle cx="10.4" cy="8.4" r=".9" fill="#f8dd8f"/><circle cx="13.5" cy="8.4" r=".9" fill="#f8dd8f"/><circle cx="10.4" cy="11.6" r=".9" fill="#f8dd8f"/><circle cx="13.5" cy="11.6" r=".9" fill="#f8dd8f"/><circle cx="10.4" cy="14.8" r=".9" fill="#f8dd8f"/><circle cx="13.5" cy="14.8" r=".9" fill="#f8dd8f"/><circle cx="12" cy="17.8" r=".9" fill="#f8dd8f"/></svg>`,
berry:`<svg viewBox="0 0 24 24"><path d="M12 21.6c-4.2-2.4-6.8-5.6-6.8-9.2 0-2.9 2-5 6.8-5s6.8 2.1 6.8 5c0 3.6-2.6 6.8-6.8 9.2Z" fill="#e8503e"/><path d="M12 21.6c-1.6-.9-3-2-4.1-3.1 2.7.5 5.5.5 8.2 0-1.1 1.1-2.5 2.2-4.1 3.1Z" fill="#cf3f2e"/><ellipse cx="9.2" cy="10.4" rx="1.9" ry="1.3" fill="#f49a88" transform="rotate(-20 9.2 10.4)"/><circle cx="9.5" cy="14" r=".65" fill="#f8d5ce"/><circle cx="14.5" cy="14" r=".65" fill="#f8d5ce"/><circle cx="12" cy="16.8" r=".65" fill="#f8d5ce"/><circle cx="12" cy="11.4" r=".65" fill="#f8d5ce"/><path d="M12 3.4c.7 1.1.6 2 .6 2s1.6-.8 3-.2c-1.3 1-1.6 1.9-1.6 1.9l-2 .9-2-.9s-.3-.9-1.6-1.9c1.4-.6 3 .2 3 .2s-.1-.9.6-2Z" fill="#77ad5e"/></svg>`,
pumpkin:`<svg viewBox="0 0 24 24"><path d="M11 4.4c.2-1.2 1-1.9 2.2-2 .2.8 0 1.6-.6 2.2Z" fill="#8a6a44"/><ellipse cx="6.8" cy="13.8" rx="4.2" ry="6.2" fill="#d97f32"/><ellipse cx="17.2" cy="13.8" rx="4.2" ry="6.2" fill="#c76a24"/><ellipse cx="12" cy="13.8" rx="4.6" ry="6.6" fill="#ef9440"/><ellipse cx="10.4" cy="9.8" rx="1.6" ry="2.4" fill="#f8b877" transform="rotate(-8 10.4 9.8)"/></svg>`,
melon:`<svg viewBox="0 0 24 24"><path d="M2.8 8.4a10.4 10.4 0 0 0 18.4 0Z" fill="#5f9e4e"/><path d="M4.5 8.4a8.6 8.6 0 0 0 15 0Z" fill="#d8ecc0"/><path d="M5.8 8.4a7.2 7.2 0 0 0 12.4 0Z" fill="#ec6552"/><circle cx="9.2" cy="10.4" r=".75" fill="#5b3a2e"/><circle cx="14.8" cy="10.4" r=".75" fill="#5b3a2e"/><circle cx="12" cy="13" r=".75" fill="#5b3a2e"/><ellipse cx="8.6" cy="9" rx="1.5" ry=".8" fill="#f59d8e" transform="rotate(24 8.6 9)"/></svg>`,
grape:`<svg viewBox="0 0 24 24"><path d="M12 6.5V3.2" stroke="#8a6a44" stroke-width="1.5" stroke-linecap="round" fill="none"/><ellipse cx="15.4" cy="4.8" rx="2.8" ry="1.6" fill="#8fbf62" transform="rotate(18 15.4 4.8)"/><circle cx="8.4" cy="10" r="3" fill="#9d6fb8"/><circle cx="15.6" cy="10" r="3" fill="#8a5ca6"/><circle cx="12" cy="9" r="3" fill="#a97fc2"/><circle cx="9.6" cy="14.4" r="3" fill="#8a5ca6"/><circle cx="14.4" cy="14.4" r="3" fill="#9d6fb8"/><circle cx="12" cy="18.4" r="3" fill="#7b4f96"/><circle cx="11" cy="8" r=".9" fill="#cfaede"/><circle cx="8.6" cy="13.4" r=".8" fill="#c19fd4"/></svg>`,
pine:`<svg viewBox="0 0 24 24"><path d="M12 8 8.4 3.6c1-.5 2.4-.3 3.6.7 1.2-1 2.6-1.2 3.6-.7Z" fill="#6ba455"/><path d="M12 8.6 6.4 5.8c-.4 1.4.4 3 2 3.9l-2.6.9c1 1.4 3 1.9 4.7 1l3-1.5 3-1.5c1.6.9 3.7.4 4.7-1l-2.6-.9c1.6-.9 2.4-2.5 2-3.9Z" fill="#84b96b" transform="translate(0 -1)"/><ellipse cx="12" cy="16" rx="5.2" ry="6.6" fill="#e5aa47"/><path d="M8 11.4l8 9.2M16 11.4l-8 9.2M6.9 14.8l10.2 2.4M17.1 14.8 6.9 17.2" stroke="#c98f36" stroke-width="1" stroke-linecap="round" fill="none"/><ellipse cx="10" cy="12.6" rx="1.4" ry="2" fill="#f2cf85" transform="rotate(-14 10 12.6)"/></svg>`,
// --- продукты животных ---
egg:`<svg viewBox="0 0 24 24"><path d="M12 21.4c-3.8 0-6.2-2.4-6.2-6C5.8 11 8.4 3 12 3s6.2 8 6.2 12.4c0 3.6-2.4 6-6.2 6Z" fill="#f6ead2"/><path d="M12 21.4c3.8 0 6.2-2.4 6.2-6 0-2.4-.8-5.8-2.1-8.4.6 2.4.9 4.8.9 6.6 0 4.6-2 7.4-5 7.8Z" fill="#e5d2ac"/><ellipse cx="9.6" cy="9" rx="1.7" ry="2.7" fill="#fdf8ec" transform="rotate(-8 9.6 9)"/></svg>`,
milk:`<svg viewBox="0 0 24 24"><path d="M9 3h6v2.6l1.6 3.2c.3.6.4 1.1.4 1.8v9.2c0 1.2-1 2.2-2.2 2.2H9.2C8 22 7 21 7 19.8v-9.2c0-.7.1-1.2.4-1.8L9 5.6Z" fill="#f3f6f8"/><path d="M17 11.5v8.3c0 1.2-1 2.2-2.2 2.2H12c2 0 3-1 3-2.6v-8c0-1-.3-1.8-.8-2.8L13 5.6V3h2v2.6l1.6 3.2c.3.6.4 1.1.4 1.8Z" fill="#d9e3ea"/><path d="M7 13h10v5H7Z" fill="#9ec1e0"/><path d="M15 13h2v5h-2z" fill="#87abcc"/><ellipse cx="9.8" cy="9.4" rx="1.2" ry="1.9" fill="#ffffff" transform="rotate(-6 9.8 9.4)"/><path d="M9.5 3h5v1.6h-5z" fill="#c9d6e0"/></svg>`,
wool:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12.6" r="8" fill="#f0e6d4"/><path d="M12 4.6a8 8 0 0 1 8 8 8 8 0 0 1-2.4 5.7A8 8 0 0 0 12 4.6Z" fill="#ddcdb2"/><path d="M5 10.2c4.4-1.4 9.6-1.4 14 0M4.3 14c4.8-1.5 10.6-1.5 15.4 0M6.4 17.6c3.6-1.1 7.6-1.1 11.2 0" stroke="#c9b493" stroke-width="1.1" stroke-linecap="round" fill="none"/><ellipse cx="9" cy="8" rx="2" ry="1.3" fill="#faf4e6" transform="rotate(-22 9 8)"/></svg>`,
// --- животные ---
hen:`<svg viewBox="0 0 24 24"><circle cx="9.6" cy="6.2" r="1.1" fill="#e2725a"/><circle cx="11.4" cy="5.6" r="1.1" fill="#e2725a"/><path d="M12 21c-4.6 0-7.6-2.6-7.6-6.4 0-4.4 3-8 6.8-8 4.4 0 8.4 3.4 8.4 8.2 0 3.8-3 6.2-7.6 6.2Z" fill="#f6efdf"/><path d="M12 21c4.6 0 7.6-2.4 7.6-6.2 0-2.4-1-4.5-2.6-6 .6 1.2 1 2.6 1 4.2 0 4.6-2.7 7.6-6 8Z" fill="#e3d6bc"/><path d="M4.6 13.4c-1.5 0-2.6.9-2.9 2.2 1.3.8 2.9.6 3.9-.4Z" fill="#e8c15e"/><circle cx="8.8" cy="10.6" r=".85" fill="#4a3b2e"/><circle cx="13.2" cy="10.6" r=".85" fill="#4a3b2e"/><path d="M11 12.1c.6-.5 1.4-.5 2 0-.3.9-.9 1.4-1 1.4s-.7-.5-1-1.4Z" fill="#eda63f"/><circle cx="7.6" cy="13" r="1" fill="#f0b1a4" opacity=".8"/><circle cx="14.4" cy="13" r="1" fill="#f0b1a4" opacity=".8"/><ellipse cx="8.6" cy="7.8" rx="1.7" ry="1.1" fill="#fdfaf0" transform="rotate(-18 8.6 7.8)"/></svg>`,
cow:`<svg viewBox="0 0 24 24"><ellipse cx="5.4" cy="7.4" rx="2.2" ry="1.4" fill="#e0cfae" transform="rotate(-28 5.4 7.4)"/><ellipse cx="18.6" cy="7.4" rx="2.2" ry="1.4" fill="#cbb89a" transform="rotate(28 18.6 7.4)"/><path d="M12 21c-4.8 0-8-2.7-8-6.6C4 10 7.4 6 12 6s8 4 8 8.4c0 3.9-3.2 6.6-8 6.6Z" fill="#f5f0e4"/><path d="M12 21c4.8 0 8-2.7 8-6.6 0-2.6-1.2-5-3-6.6.8 1.4 1.2 3 1.2 4.8 0 4.8-2.8 8-6.2 8.4Z" fill="#e2d8c2"/><path d="M15.5 7c1.8.6 3.2 2 4 3.8-1.5 1-3.5.8-4.7-.5Z" fill="#b09272"/><circle cx="8.8" cy="11.2" r=".85" fill="#4a3b2e"/><circle cx="15.2" cy="11.2" r=".85" fill="#4a3b2e"/><ellipse cx="12" cy="16" rx="4.2" ry="2.8" fill="#f3c1b4"/><ellipse cx="12" cy="15.6" rx="3.4" ry="2" fill="#f8d5ca"/><circle cx="10.6" cy="15.8" r=".6" fill="#d59685"/><circle cx="13.4" cy="15.8" r=".6" fill="#d59685"/><ellipse cx="8.8" cy="8.4" rx="1.8" ry="1.1" fill="#fdfbf4" transform="rotate(-16 8.8 8.4)"/></svg>`,
sheep:`<svg viewBox="0 0 24 24"><circle cx="6.4" cy="9.4" r="3" fill="#f0e6d4"/><circle cx="17.6" cy="9.4" r="3" fill="#e3d6bc"/><circle cx="8.8" cy="6.6" r="3" fill="#f4ecdd"/><circle cx="15.2" cy="6.6" r="3" fill="#ece1c9"/><circle cx="12" cy="5.8" r="3.1" fill="#f6efe2"/><circle cx="5.6" cy="13.6" r="3" fill="#ece1c9"/><circle cx="18.4" cy="13.6" r="3" fill="#ddd0b4"/><ellipse cx="12" cy="12.4" rx="7.4" ry="6.8" fill="#f6efe2"/><path d="M12 19.2c4 0 6.8-2.6 7.2-6-0.2 4.4-3 7.4-7.2 7.4Z" fill="#e0d3b8"/><ellipse cx="12" cy="14.2" rx="4.4" ry="4.2" fill="#cbb59a"/><ellipse cx="12" cy="13.6" rx="3.7" ry="3.4" fill="#dcc9ad"/><circle cx="10.5" cy="13" r=".8" fill="#4a3b2e"/><circle cx="13.5" cy="13" r=".8" fill="#4a3b2e"/><ellipse cx="12" cy="15.4" rx="1" ry=".7" fill="#b09272"/><circle cx="9.3" cy="14.8" r=".9" fill="#f0b1a4" opacity=".7"/><circle cx="14.7" cy="14.8" r=".9" fill="#f0b1a4" opacity=".7"/></svg>`,
// --- работники ---
harv:`<svg viewBox="0 0 24 24"><path d="M4 10h16l-1.6 8.4c-.2 1-1 1.6-2 1.6H7.6c-1 0-1.8-.6-2-1.6Z" fill="#c9a06a"/><path d="M20 10l-1.6 8.4c-.2 1-1 1.6-2 1.6H12c3.4 0 5.2-3.4 6-10Z" fill="#b1874f"/><path d="M4.6 13.2h14.8M5.2 16.4h13.6" stroke="#a97f48" stroke-width="1" fill="none"/><path d="M8 15v4.6M12 15v5M16 15v4.6" stroke="#a97f48" stroke-width="1" fill="none" opacity=".7"/><rect x="3.4" y="9" width="17.2" height="2.4" rx="1.2" fill="#dbb885"/><circle cx="9" cy="7.6" r="2.4" fill="#e8563f"/><circle cx="13.6" cy="6.8" r="2.6" fill="#ef9440"/><circle cx="17" cy="8" r="2" fill="#8fbf62"/><circle cx="12.9" cy="6" r=".8" fill="#f8c88b"/></svg>`,
sow:`<svg viewBox="0 0 24 24"><path d="M7 8.5C7 6 9 4.6 12 4.6S17 6 17 8.5l.9 9.1c.2 2-1.3 3.4-3.3 3.4H9.4c-2 0-3.5-1.4-3.3-3.4Z" fill="#d9b478"/><path d="M17 8.5l.9 9.1c.2 2-1.3 3.4-3.3 3.4H12c2.4 0 3.6-1.5 3.4-3.8L14.7 8c-.1-1.8-1-3-2.7-3.4 2.9.1 5 1.5 5 3.9Z" fill="#c09455"/><path d="M7.4 8.2c3 .9 6.2.9 9.2 0" stroke="#a97f48" stroke-width="1.3" fill="none" stroke-linecap="round"/><ellipse cx="12" cy="14.6" rx="3.4" ry="3" fill="#f2e3c4"/><ellipse cx="10.8" cy="13.6" rx="1.1" ry="1.7" fill="#8a6749" transform="rotate(-30 10.8 13.6)"/><ellipse cx="13.4" cy="14.4" rx="1.1" ry="1.7" fill="#a07a52" transform="rotate(24 13.4 14.4)"/><ellipse cx="11.8" cy="16.4" rx="1.1" ry="1.5" fill="#8a6749" transform="rotate(80 11.8 16.4)"/><ellipse cx="9.4" cy="6.4" rx="1.3" ry=".8" fill="#ecd0a0" transform="rotate(-20 9.4 6.4)"/></svg>`,
tract:`<svg viewBox="0 0 24 24"><path d="M9 5h5l1.4 4H9Z" fill="#cf4530"/><path d="M9.8 6h3.4l.9 2.6h-4.3Z" fill="#bfe0ea"/><path d="M4.6 9h12.8c1.4 0 2.4 1 2.4 2.4v3.2H3.4v-3.4C3.4 9.9 3.9 9 4.6 9Z" fill="#e8563f"/><path d="M17.4 9c1.4 0 2.4 1 2.4 2.4v3.2h-3.4V9Z" fill="#cf4530"/><circle cx="7.6" cy="15.8" r="4" fill="#5b4a3a"/><circle cx="7.6" cy="15.8" r="2" fill="#8a7460"/><circle cx="16.8" cy="16.8" r="2.9" fill="#5b4a3a"/><circle cx="16.8" cy="16.8" r="1.4" fill="#8a7460"/><rect x="4.6" y="9.8" width="4" height="1.4" rx=".7" fill="#f2917e"/></svg>`,
// --- улучшения ---
fert:`<svg viewBox="0 0 24 24"><path d="M6.5 7.5h11l1 11.3c.1 1.2-.9 2.2-2.1 2.2H7.6c-1.2 0-2.2-1-2.1-2.2Z" fill="#c9a06a"/><path d="M17.5 7.5l1 11.3c.1 1.2-.9 2.2-2.1 2.2H13c1.6 0 2.6-1 2.5-2.6l-.8-10.9Z" fill="#b1874f"/><rect x="6" y="6" width="12" height="2.6" rx="1.3" fill="#dbb885"/><path d="M12 17.6v-3.4" stroke="#6ba455" stroke-width="1.4" stroke-linecap="round" fill="none"/><path d="M12 14.4c-.2-1.7-1.4-2.8-3.1-2.9 0 1.8 1.3 3 3.1 2.9Z" fill="#8fbf62"/><path d="M12 14.4c.2-1.7 1.4-2.8 3.1-2.9 0 1.8-1.3 3-3.1 2.9Z" fill="#6ba455"/></svg>`,
comp:`<svg viewBox="0 0 24 24"><path d="M12 21v-8" stroke="#6f9e4f" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M12 14.2C11.7 10.6 9.2 8.3 5.6 8.2c.1 3.8 2.8 6.2 6.4 6Z" fill="#8fbf62"/><path d="M12 14.2c.3-3.6 2.8-5.9 6.4-6-.1 3.8-2.8 6.2-6.4 6Z" fill="#6ba455"/><path d="M12 8.6c-.2-2.4-1.8-4-4.2-4.1 0 2.6 1.8 4.2 4.2 4.1Z" fill="#a9d07c"/><ellipse cx="7.6" cy="10.2" rx="1.4" ry=".8" fill="#c4e2a9" transform="rotate(-32 7.6 10.2)"/></svg>`,
wh:`<svg viewBox="0 0 24 24"><path d="M12 3 3.6 9.6V21h16.8V9.6Z" fill="#c9765c"/><path d="M12 3l8.4 6.6V21h-4.2V9.9Z" fill="#b25f47"/><path d="M12 2.2 2.6 9.5c.7.9 2 1 2.9.3L12 4.9l6.5 4.9c.9.7 2.2.6 2.9-.3Z" fill="#8a6749"/><rect x="8.6" y="13" width="6.8" height="8" rx="1" fill="#8a6749"/><rect x="9.4" y="13.8" width="5.2" height="7.2" rx=".8" fill="#a07a52"/><path d="M9.4 14.4l5.2 5.8M14.6 14.4l-5.2 5.8" stroke="#8a6749" stroke-width="1.1" fill="none"/><circle cx="12" cy="9.6" r="1.7" fill="#f6efdf"/></svg>`,
gold:`<svg viewBox="0 0 24 24"><path d="M12 2.6c.8 4.6 2.4 6.2 7 7-4.6.8-6.2 2.4-7 7-.8-4.6-2.4-6.2-7-7 4.6-.8 6.2-2.4 7-7Z" fill="#f0c95e"/><path d="M12 2.6c.8 4.6 2.4 6.2 7 7-4.6.8-6.2 2.4-7 7Z" fill="#e0ae3f"/><path d="M17.6 13.4c.5 2.6 1.4 3.5 4 4-2.6.5-3.5 1.4-4 4-.5-2.6-1.4-3.5-4-4 2.6-.5 3.5-1.4 4-4Z" fill="#f4d67e"/><path d="M6.4 14.6c.4 2 1.1 2.7 3.1 3.1-2 .4-2.7 1.1-3.1 3.1-.4-2-1.1-2.7-3.1-3.1 2-.4 2.7-1.1 3.1-3.1Z" fill="#eec254"/></svg>`,
// --- интерфейс ---
coin:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.4" fill="#dfa32e"/><circle cx="12" cy="11.4" r="8.6" fill="#f0c95e"/><circle cx="12" cy="11.4" r="5.6" fill="#e5b23f"/><path d="M12 8.2c.5 1.6 1.2 2.3 2.8 2.8-1.6.5-2.3 1.2-2.8 2.8-.5-1.6-1.2-2.3-2.8-2.8 1.6-.5 2.3-1.2 2.8-2.8Z" fill="#f6dc94"/><ellipse cx="8.6" cy="6.8" rx="2.4" ry="1.3" fill="#f8e3a5" transform="rotate(-28 8.6 6.8)"/></svg>`,
seed:`<svg viewBox="0 0 24 24"><path d="M12 21.5c-3.6 0-6-2.3-6-5.7C6 10.6 9.4 5 12 2.6 14.6 5 18 10.6 18 15.8c0 3.4-2.4 5.7-6 5.7Z" fill="#f0c95e"/><path d="M12 21.5c3.6 0 6-2.3 6-5.7 0-3.4-1.5-7.1-3.4-9.9 1 2.4 1.6 5 1.6 7.3 0 4.6-1.7 7.6-4.2 8.3Z" fill="#dfa32e"/><ellipse cx="9.8" cy="9.6" rx="1.5" ry="2.6" fill="#f8e3a5" transform="rotate(-10 9.8 9.6)"/><path d="M19.4 4.2c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5Z" fill="#f6dc94"/></svg>`,
ips:`<svg viewBox="0 0 24 24"><circle cx="10" cy="14" r="8" fill="#dfa32e"/><circle cx="10" cy="13.4" r="7.2" fill="#f0c95e"/><circle cx="10" cy="13.4" r="4.6" fill="#e5b23f"/><ellipse cx="7.2" cy="9.6" rx="2" ry="1.1" fill="#f8e3a5" transform="rotate(-28 7.2 9.6)"/><path d="M18.5 2.6 22 7.4h-2.3v4.2h-2.4V7.4H15Z" fill="#7fb35f"/><path d="M18.5 2.6 22 7.4h-2.3v4.2h-1.2V4.3Z" fill="#6ba04c"/></svg>`,
barn:`<svg viewBox="0 0 24 24"><path d="M12 2.6 3 9.4V21h18V9.4Z" fill="#d97f6a"/><path d="M12 2.6 21 9.4V21h-4.6V9.8Z" fill="#c2604a"/><path d="M12 1.8 2 9.4c.7 1 2.1 1.2 3 .4l7-5.3 7 5.3c.9.8 2.3.6 3-.4Z" fill="#a07a52"/><rect x="8.4" y="12.6" width="7.2" height="8.4" rx="1" fill="#8a6749"/><rect x="9.3" y="13.5" width="5.4" height="7.5" rx=".8" fill="#c9a578"/><path d="M9.3 14.2l5.4 6M14.7 14.2l-5.4 6" stroke="#8a6749" stroke-width="1.2" fill="none"/><circle cx="12" cy="9.2" r="1.9" fill="#fdf8ec"/><circle cx="12" cy="9.2" r="1" fill="#bfe0ea"/></svg>`,
orders:`<svg viewBox="0 0 24 24"><rect x="4.4" y="3.6" width="15.2" height="18" rx="2.4" fill="#e8dcc0"/><path d="M17.2 3.6h.2c1.2 0 2.2 1 2.2 2.2v13.6c0 1.2-1 2.2-2.2 2.2h-5c3.2-.8 4.8-6.8 4.8-18Z" fill="#d9c9a6"/><rect x="6.6" y="2.2" width="10.8" height="3.6" rx="1.6" fill="#a8cc80"/><path d="M8.2 10.2l1.3 1.4 2.4-2.6" stroke="#7fb35f" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M13.6 10.2h3.6" stroke="#b7a789" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M8.2 15.2l1.3 1.4 2.4-2.6" stroke="#7fb35f" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M13.6 15.2h3.6" stroke="#b7a789" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>`,
shop:`<svg viewBox="0 0 24 24"><rect x="4.4" y="10" width="15.2" height="11" rx="1.6" fill="#e8dcc0"/><path d="M16 10h3.6v9c0 1.2-1 2-2.2 2H15c1-.7 1.4-2 1.4-4Z" fill="#d9c9a6"/><path d="M3 4.4C3 3.6 3.6 3 4.4 3h15.2c.8 0 1.4.6 1.4 1.4V6c0 2-1.1 3.6-3 3.6-1.3 0-2.3-.7-3-1.8-.7 1.1-1.7 1.8-3 1.8s-2.3-.7-3-1.8C8.3 8.9 7.3 9.6 6 9.6c-1.9 0-3-1.6-3-3.6Z" fill="#e2725a"/><path d="M9 3h6v3.2c0 2-1.1 3.4-3 3.4S9 8.2 9 6.2Z" fill="#f6efdf"/><rect x="9.4" y="13.2" width="5.2" height="7.8" rx="1" fill="#a07a52"/><rect x="10.2" y="14" width="3.6" height="7" rx=".8" fill="#c9a578"/></svg>`,
album:`<svg viewBox="0 0 24 24"><path d="M5 4.6C5 3.4 6 2.4 7.2 2.4h11.4v17.2H7.4c-.9 0-1.6.3-2.4.8Z" fill="#8fb56d"/><path d="M14 2.4h4.6v17.2H14Z" fill="#7ba15a"/><path d="M5 19.6c.8-.5 1.5-.8 2.4-.8h11.2v2.8H7.2c-1.2 0-2.2-.9-2.2-2Z" fill="#f0e6d0"/><path d="M9 8.2c.9 0 1.6.5 2 1.2.4-.7 1.1-1.2 2-1.2 1.3 0 2.3 1 2.3 2.3 0 2-2.4 3.6-4.3 4.8-1.9-1.2-4.3-2.8-4.3-4.8C6.7 9.2 7.7 8.2 9 8.2Z" fill="#f6efdf"/></svg>`,
star:`<svg viewBox="0 0 24 24"><path d="M12 2.8c.8 0 1.4.4 1.8 1.2l1.9 4 4.3.6c1.7.3 2.3 2 1.1 3.2l-3.2 3 .8 4.4c.3 1.7-1.2 2.8-2.7 2l-4-2.1-4 2.1c-1.5.8-3-.3-2.7-2l.8-4.4-3.2-3C1.7 10.6 2.3 8.9 4 8.6l4.3-.6 1.9-4c.4-.8 1-1.2 1.8-1.2Z" fill="#f0c95e"/><path d="M12 2.8c.8 0 1.4.4 1.8 1.2l1.9 4 4.3.6c1.7.3 2.3 2 1.1 3.2l-3.2 3 .8 4.4c.3 1.7-1.2 2.8-2.7 2l-4-2.1Z" fill="#e0ae3f"/><ellipse cx="8.8" cy="8.4" rx="1.7" ry="1" fill="#f8e3a5" transform="rotate(-30 8.8 8.4)"/></svg>`,
sound:`<svg viewBox="0 0 24 24"><path d="M4 9.4h3.6L13 5v14l-5.4-4.4H4c-.8 0-1.4-.6-1.4-1.4v-2.4c0-.8.6-1.4 1.4-1.4Z" fill="#8a7460"/><path d="M13 5v14l-2.6-2.1V7.1Z" fill="#75604d"/><path d="M16.2 9.2c1.5 1.5 1.5 4.1 0 5.6" stroke="#c9a578" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M18.8 6.8c2.8 2.8 2.8 7.6 0 10.4" stroke="#dbbb8e" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`,
mute:`<svg viewBox="0 0 24 24"><path d="M4 9.4h3.6L13 5v14l-5.4-4.4H4c-.8 0-1.4-.6-1.4-1.4v-2.4c0-.8.6-1.4 1.4-1.4Z" fill="#b7a789"/><path d="M13 5v14l-2.6-2.1V7.1Z" fill="#a5947a"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="#e2725a" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`,
ad:`<svg viewBox="0 0 24 24"><rect x="2.6" y="4.6" width="18.8" height="13.4" rx="2.6" fill="#8a7460"/><rect x="4.2" y="6.2" width="15.6" height="10.2" rx="1.6" fill="#bfe0ea"/><path d="M19.8 6.4c0 5.4-2.4 8.8-7.2 9.9h5.6c.9 0 1.6-.7 1.6-1.6Z" fill="#a3ccd8"/><path d="M10.4 8.8l4.6 2.8-4.6 2.8Z" fill="#e2725a"/><path d="M9 21.4c1.9-.8 4.1-.8 6 0" stroke="#8a7460" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`,
boost:`<svg viewBox="0 0 24 24"><path d="M14.8 2.8c3.4 1.1 5.8 3.5 6.4 6.9-2.4 2.4-5.2 3.9-8 4.4l-3.3-3.3c.5-2.8 2-5.6 4.9-8Z" fill="#bfe0ea"/><path d="M21.2 9.7c-2.4 2.4-5.2 3.9-8 4.4l-1.6-1.6c3.5-.7 6.5-2.6 9.2-5.6.2.9.4 1.8.4 2.8Z" fill="#a3ccd8"/><circle cx="15.4" cy="8.6" r="2.1" fill="#f6efdf"/><circle cx="15.4" cy="8.6" r="1.1" fill="#7fb3c4"/><path d="M9.9 10.8 6 12.2c1-1.9 2.3-3 4.5-3.3Z" fill="#e2725a"/><path d="M13.2 14.1l-1.4 3.9c1.9-1 3-2.3 3.3-4.5Z" fill="#e2725a"/><path d="M8.4 15.6c-1.3 1.3-2.1 3.2-2.4 5.6 2.4-.3 4.3-1.1 5.6-2.4Z" fill="#f0a049"/><path d="M11.6 18.8c-1.3 1.3-3.2 2.1-5.6 2.4 2.4-.3 4.3-1.1 5.6-2.4Z" fill="#e2725a"/></svg>`,
grow:`<svg viewBox="0 0 24 24"><path d="M12 21.6v-9" stroke="#6f9e4f" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M12 15.2c-.4-3.8-3-6.2-6.8-6.3.1 4 3 6.6 6.8 6.3Z" fill="#8fbf62"/><path d="M12 15.2c.4-3.8 3-6.2 6.8-6.3-.1 4-3 6.6-6.8 6.3Z" fill="#6ba455"/><path d="M12 8.8c-.2-2.6-2-4.3-4.5-4.4 0 2.8 2 4.5 4.5 4.4Z" fill="#a9d07c"/><path d="M12 8.8c.2-2.6 2-4.3 4.5-4.4 0 2.8-2 4.5-4.5 4.4Z" fill="#8fbf62"/></svg>`,
sell:`<svg viewBox="0 0 24 24"><ellipse cx="10" cy="17.4" rx="7" ry="3.4" fill="#dfa32e"/><ellipse cx="10" cy="16.4" rx="7" ry="3.4" fill="#f0c95e"/><ellipse cx="10" cy="12.9" rx="7" ry="3.4" fill="#dfa32e"/><ellipse cx="10" cy="11.9" rx="7" ry="3.4" fill="#f0c95e"/><ellipse cx="10" cy="11.9" rx="4.4" ry="2" fill="#e5b23f"/><path d="M19 4l3.4 4.6h-2.2v4h-2.4v-4h-2.2Z" fill="#7fb35f"/></svg>`,
chest:`<svg viewBox="0 0 24 24"><path d="M3.4 10.4h17.2V19c0 1.2-1 2.2-2.2 2.2H5.6c-1.2 0-2.2-1-2.2-2.2Z" fill="#a07a52"/><path d="M20.6 10.4V19c0 1.2-1 2.2-2.2 2.2h-4c1.6-1 2.4-4.6 2.4-10.8Z" fill="#8a6749"/><path d="M3.4 10.4C3.4 7 5.4 4.8 8.6 4.8h6.8c3.2 0 5.2 2.2 5.2 5.6Z" fill="#c9a578"/><path d="M20.6 10.4c0-3.4-2-5.6-5.2-5.6h-2.6c2.9 0 4.6 2.2 4.6 5.6Z" fill="#b1874f"/><rect x="10.4" y="9" width="3.2" height="5" rx="1.4" fill="#f0c95e"/><circle cx="12" cy="11" r=".8" fill="#c98f36"/></svg>`,
gift:`<svg viewBox="0 0 24 24"><rect x="4" y="9.6" width="16" height="11.4" rx="2" fill="#e88ba4"/><path d="M20 9.6v9.2c0 1.2-1 2.2-2.2 2.2H13c2.8-1.4 4-5 4-11.4Z" fill="#d4718c"/><rect x="3.4" y="6.4" width="17.2" height="4" rx="1.8" fill="#f2a9bd"/><rect x="10.6" y="6.4" width="2.8" height="14.6" fill="#f6dc94"/><path d="M12 6.2C10.4 4 8.6 3 6.8 3.4c-.4 1.8.8 3.2 3 3.2Z" fill="#f0c95e"/><path d="M12 6.2C13.6 4 15.4 3 17.2 3.4c.4 1.8-.8 3.2-3 3.2Z" fill="#e5b23f"/></svg>`,
check:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.6" fill="#8fbf62"/><path d="M12 2.4a9.6 9.6 0 0 1 9.6 9.6 9.6 9.6 0 0 1-3 7A9.6 9.6 0 0 0 12 2.4Z" fill="#7aab4e"/><path d="M7.4 12.4l3 3.2 6.2-7" stroke="#fdf8ec" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,
lock:`<svg viewBox="0 0 24 24"><path d="M7.4 11V8.6C7.4 5.8 9.3 4 12 4s4.6 1.8 4.6 4.6V11h-2.4V8.7c0-1.5-.8-2.4-2.2-2.4s-2.2.9-2.2 2.4V11Z" fill="#a5947a"/><rect x="4.8" y="10.4" width="14.4" height="10.6" rx="2.4" fill="#c9b493"/><path d="M19.2 12.8v5.8c0 1.2-1 2.4-2.2 2.4h-4c3.4-.6 4.8-4.4 4.4-10.6h.6c.7 0 1.2 1 1.2 2.4Z" fill="#b7a17e"/><circle cx="12" cy="15" r="1.7" fill="#8a7460"/><path d="M11.2 15.8h1.6l.4 2.6h-2.4Z" fill="#8a7460"/></svg>`,
quest:`<svg viewBox="0 0 24 24"><rect x="4.4" y="3.6" width="15.2" height="18" rx="2.4" fill="#e8dcc0"/><path d="M17.2 3.6h.2c1.2 0 2.2 1 2.2 2.2v13.6c0 1.2-1 2.2-2.2 2.2h-5c3.2-.8 4.8-6.8 4.8-18Z" fill="#d9c9a6"/><rect x="6.6" y="2.2" width="10.8" height="3.6" rx="1.6" fill="#eeb45f"/><path d="M7.8 10h8.4M7.8 13.4h8.4M7.8 16.8h5" stroke="#b7a789" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>`,
refresh:`<svg viewBox="0 0 24 24"><path d="M12 4.2a7.8 7.8 0 0 1 7.4 5.4h-2.9L20.6 14l4-4.4h-2.7A9.9 9.9 0 0 0 12 2.1Z" fill="#a5947a" transform="translate(-1.4 .4)"/><path d="M12 19.8a7.8 7.8 0 0 1-7.4-5.4h2.9L3.4 10l-4 4.4h2.7A9.9 9.9 0 0 0 12 21.9Z" fill="#b7a789" transform="translate(1.4 -.4)"/></svg>`,
moon:`<svg viewBox="0 0 24 24"><path d="M13.8 2.8a9.4 9.4 0 1 0 7.4 12.6c-1.2.5-2.4.8-3.8.8a9 9 0 0 1-3.6-13.4Z" fill="#f0c95e"/><path d="M21.2 15.4c-1.2.5-2.4.8-3.8.8-2 0-3.8-.7-5.3-1.8 2.9 3.6 6 4.3 9.1 1Z" fill="#dfa32e"/><circle cx="8.4" cy="9" r="1.3" fill="#f6dc94"/><circle cx="11" cy="14.6" r=".9" fill="#f6dc94"/></svg>`,
down:`<svg viewBox="0 0 24 24"><path d="M12 21.2 3.6 11.4c-.9-1.1-.1-2.8 1.4-2.8h3V4.2C8 3 9 2 10.2 2h3.6C15 2 16 3 16 4.2v4.4h3c1.5 0 2.3 1.7 1.4 2.8Z" fill="#eeb45f"/><path d="M12 21.2 20.4 11.4c.9-1.1.1-2.8-1.4-2.8h-1.6Z" fill="#dd9a45"/></svg>`,
trophy:`<svg viewBox="0 0 24 24"><path d="M5 4.8h14v4.4c0 3.6-3 6.4-7 6.4s-7-2.8-7-6.4Z" fill="#f0c95e"/><path d="M19 4.8v4.4c0 3.6-3 6.4-7 6.4 2.6-1.4 4-4 4-7.8V4.8Z" fill="#e0ae3f"/><path d="M5 6H2.6c0 3 1.4 5 3.6 5.6M19 6h2.4c0 3-1.4 5-3.6 5.6" stroke="#dfa32e" stroke-width="1.7" fill="none"/><rect x="10.6" y="15" width="2.8" height="3.4" fill="#e0ae3f"/><rect x="7.6" y="18" width="8.8" height="3" rx="1.4" fill="#a07a52"/><ellipse cx="8.6" cy="7" rx="1.6" ry="2.2" fill="#f8e3a5" transform="rotate(-8 8.6 7)"/></svg>`,
};
const ic = id => ICONS[id] || '';
const icc = id => `<i class="ci">${ic(id)}</i>`; // маленькая inline-иконка
const $ = id => document.getElementById(id);
let uiTouch = 0;
let shopTab = 'seeds', orderTab = 'orders', albumTab = 'coll';

function uiBlocked() {
    return performance.now() - uiTouch < 350 ||
        document.querySelector('.sheet.open, .modal.open') !== null;
}

// ---------- Инициализация ----------
function initUI() {
    document.body.classList.add('ready');
    // подставить SVG-иконки во все статичные плейсхолдеры
    for (const el of document.querySelectorAll('[data-ico]'))
        el.innerHTML = ic(el.dataset.ico);
    // любой тап по DOM-интерфейсу блокирует поле
    for (const el of document.querySelectorAll('.ui'))
        el.addEventListener('pointerdown', () => uiTouch = performance.now());

    $('barnFab').onclick   = () => { openSheet('barnSheet'); renderBarn(); if (S.tut===2) renderTut(); };
    $('orderFab').onclick  = () => { openSheet('orderSheet'); renderOrders(); };
    $('shopFab').onclick   = () => { openSheet('shopSheet'); renderShop(); };
    $('albumFab').onclick  = () => { openSheet('albumSheet'); renderAlbum(); };
    $('prestigeFab').onclick = showPrestige;
    $('cropBtn').onclick   = () => { shopTab = 'seeds'; openSheet('shopSheet'); renderShop(); };
    $('boostBtn').onclick  = adBoost;
    $('growBtn').onclick   = adGrowAll;
    $('muteBtn').onclick   = () => { toggleMute(); renderHud(); };
    $('overlay').onclick   = closeAllSheets;
    for (const b of document.querySelectorAll('.close'))
        b.onclick = closeAllSheets;
    for (const b of document.querySelectorAll('#shopSheet .tab'))
        b.onclick = () => { shopTab = b.dataset.tab; sfx('click'); renderShop(); };
    for (const b of document.querySelectorAll('#orderSheet .tab'))
        b.onclick = () => { orderTab = b.dataset.tab; sfx('click'); renderOrders(); };
    for (const b of document.querySelectorAll('#albumSheet .tab'))
        b.onclick = () => { albumTab = b.dataset.tab; sfx('click'); renderAlbum(); };
    $('sellAllBtn').onclick = sellAll;
    $('prestigeGo').onclick = () => { doPrestige(); closeModal('prestigeModal'); };
    for (const b of document.querySelectorAll('.modal .close2'))
        b.onclick = () => closeModal(b.closest('.modal').id);

    setInterval(uiTick, 500);
}
function uiTick() {
    if (!booted) return;
    renderHud();
    if ($('barnSheet').classList.contains('open')) renderBarn();
    if ($('orderSheet').classList.contains('open')) renderOrders();
    if ($('shopSheet').classList.contains('open')) renderShop();
    if (S.tut < 3) posTut();
}

// ---------- Панели ----------
function openSheet(id) {
    closeAllSheets();
    $(id).classList.add('open');
    $('overlay').classList.add('open');
    sfx('click');
}
function closeAllSheets() {
    for (const s of document.querySelectorAll('.sheet.open')) s.classList.remove('open');
    $('overlay').classList.remove('open');
}
function closeModal(id) { $(id).classList.remove('open'); }
function openModal(id) { $(id).classList.add('open'); }

// ---------- HUD ----------
let _prevCoins = null, _prevSeeds = null;
function popChip(id) {
    const el = $(id); if (!el) return;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}
function renderHud() {
    const coinTxt = fmt(S.coins);
    if (_prevCoins !== null && coinTxt !== _prevCoins) popChip('coinChip');
    _prevCoins = coinTxt;
    if (_prevSeeds !== null && S.seeds !== _prevSeeds) popChip('seedChip');
    _prevSeeds = S.seeds;
    $('coinVal').textContent = coinTxt;
    $('seedVal').textContent = fmt(S.seeds);
    $('ipsVal').textContent  = (S.ips >= .5 ? fmt(S.ips) : '0') + '/с';
    $('seedChip').style.display = (S.seeds > 0 || pendingSeeds() > 0 || S.cnt.prestiges > 0) ? '' : 'none';

    const c = CROPS[S.lastCrop];
    $('cropBtn').innerHTML = icc(c.id) + ' <b>' + c.name + '</b> ▾';

    // буст
    if (boostOn()) {
        $('boostBtn').classList.add('on');
        $('boostBtn').innerHTML = icc('boost') + ' x2 · ' + Math.ceil((S.boostUntil-Date.now())/1000) + 'с';
    } else {
        $('boostBtn').classList.remove('on');
        $('boostBtn').innerHTML = icc('ad') + ' Доход x2';
    }
    // дорастить
    const cd = Math.ceil((S.adGrowAt - Date.now())/1000);
    $('growBtn').disabled = cd > 0;
    $('growBtn').innerHTML = cd > 0 ? icc('grow') + ' ' + cd + 'с' : icc('ad') + ' Дорастить всё';

    $('muteBtn').innerHTML = `<span class="fico">${ic(S.mute ? 'mute' : 'sound')}</span>`;

    // бейджи
    const tot = storeTotal();
    $('barnBadge').textContent = tot;
    $('barnBadge').style.display = tot ? '' : 'none';
    const ordReady = S.orders.filter(o => (S.store[CROPS[o.crop].id]||0) >= o.qty).length
        + S.quests.filter(q => !q.claimed && qProg(q) >= q.n).length;
    $('orderBadge').textContent = ordReady;
    $('orderBadge').style.display = ordReady ? '' : 'none';
    const ps = pendingSeeds();
    $('prestigeFab').style.display = (ps > 0 || S.cnt.prestiges > 0) ? '' : 'none';
    $('prestigeBadge').textContent = '+' + ps;
    $('prestigeBadge').style.display = ps > 0 ? '' : 'none';
}

// ---------- Магазин ----------
function renderShop() {
    for (const b of document.querySelectorAll('#shopSheet .tab'))
        b.classList.toggle('on', b.dataset.tab === shopTab);
    const box = $('shopList');
    let h = '';
    if (shopTab === 'seeds') {
        CROPS.forEach((c, i) => {
            const un = S.crops[i];
            const zoneOk = c.zone < S.zones;
            const sel = i === S.lastCrop;
            h += `<div class="row ${sel?'sel':''}">
                <div class="ic">${ic(c.id)}</div>
                <div class="info"><b>${c.name}</b>
                <small>${fmtTime(cropGrow(c))} · семя ${fmt(c.seed)} · продажа ${fmt(Math.round(c.sell*sellMult()))} ${icc('coin')}</small></div>
                ${un
                    ? (sel ? '<span class="tag">выбрано</span>' : `<button class="btn" onclick="buyCrop(${i})">сажать</button>`)
                    : (zoneOk
                        ? `<button class="btn ${S.coins>=c.unlock?'':'no'}" onclick="buyCrop(${i})">открыть · ${fmt(c.unlock)}</button>`
                        : `<span class="tag lock">${icc('lock')} ${ZONES[c.zone].name}</span>`)}
            </div>`;
        });
    } else if (shopTab === 'ups') {
        for (const u of UPS) {
            const lvl = S.up[u.id];
            const cost = upCost(u, lvl);
            h += `<div class="row">
                <div class="ic">${ic(u.id)}</div>
                <div class="info"><b>${u.name} <em>ур.${lvl}</em></b><small>${u.desc}</small></div>
                <button class="btn ${S.coins>=cost?'':'no'}" onclick="buyUp('${u.id}')">${fmt(cost)} ${icc('coin')}</button>
            </div>`;
        }
    } else if (shopTab === 'work') {
        for (const w of WORKERS) {
            const lvl = S.workers[w.id];
            const maxed = lvl >= w.max;
            const cost = workerCost(w, lvl);
            h += `<div class="row">
                <div class="ic">${ic(w.id)}</div>
                <div class="info"><b>${w.name} <em>${lvl ? 'ур.'+lvl : ''}</em></b><small>${w.desc}</small></div>
                ${maxed ? '<span class="tag">макс</span>'
                        : `<button class="btn ${S.coins>=cost?'':'no'}" onclick="buyWorker('${w.id}')">${fmt(cost)} ${icc('coin')}</button>`}
            </div>`;
        }
    } else {
        for (const a of ANIMALS) {
            const n = S.animals[a.id];
            const maxed = n >= a.max;
            const cost = animalCost(a, n);
            const pr = APRODS[a.prod];
            h += `<div class="row">
                <div class="ic">${ic(a.id)}</div>
                <div class="info"><b>${a.name} <em>x${n}</em></b>
                <small>${icc(pr.id)} ${pr.name} каждые ${fmtTime(a.every)} · цена ${fmt(Math.round(pr.sell*sellMult()))} ${icc('coin')}</small></div>
                ${maxed ? '<span class="tag">макс</span>'
                        : `<button class="btn ${S.coins>=cost?'':'no'}" onclick="buyAnimal('${a.id}')">${fmt(cost)} ${icc('coin')}</button>`}
            </div>`;
        }
    }
    box.innerHTML = h;
}

// ---------- Склад ----------
function renderBarn() {
    const tot = storeTotal(), cap = whCap();
    $('barnCap').innerHTML = `Склад: <b>${tot} / ${cap}</b>`;
    $('barnBar').style.width = Math.min(100, tot/cap*100) + '%';
    const box = $('barnList');
    const ids = Object.keys(S.store);
    if (!ids.length) { box.innerHTML = '<div class="empty">Пусто. Собери урожай с грядок!</div>'; return; }
    let h = '';
    for (const id of ids) {
        const c = CROPS.find(x=>x.id===id) || APRODS.find(x=>x.id===id);
        h += `<div class="row">
            <div class="ic">${ic(id)}</div>
            <div class="info"><b>${c.name} x${S.store[id]}</b><small>${fmt(priceOf(id))} ${icc('coin')} за штуку</small></div>
            <button class="btn" onclick="sellStore('${id}',1)">1</button>
            <button class="btn" onclick="sellStore('${id}')">все · ${fmt(priceOf(id)*S.store[id])}</button>
        </div>`;
    }
    box.innerHTML = h;
}

// ---------- Заказы и квесты ----------
function renderOrders() {
    for (const b of document.querySelectorAll('#orderSheet .tab'))
        b.classList.toggle('on', b.dataset.tab === orderTab);
    const box = $('orderList');
    let h = '';
    if (orderTab === 'orders') {
        S.orders.forEach((o, k) => {
            const c = CROPS[o.crop];
            const have = S.store[c.id]||0;
            const ok = have >= o.qty;
            h += `<div class="row">
                <div class="ic">${ic(c.id)}</div>
                <div class="info"><b>${c.name} x${o.qty}</b>
                <small>есть ${have}/${o.qty} · награда ${fmt(o.reward)} ${icc('coin')}${o.seed ? ' + '+icc('seed') : ''}</small></div>
                <button class="btn ${ok?'':'no'}" onclick="fulfillOrder(${k})">сдать</button>
                <button class="btn ghost" onclick="skipOrder(${k})"><span class="ci">${ic('refresh')}</span></button>
            </div>`;
        });
    } else {
        S.quests.forEach((q, k) => {
            const p = qProg(q);
            const done = p >= q.n;
            h += `<div class="row">
                <div class="ic">${ic(q.claimed ? 'check' : done ? 'gift' : 'quest')}</div>
                <div class="info"><b>${q.name}</b>
                <small>${Math.min(p,q.n)}/${q.n} · ${fmt(q.reward)} ${icc('coin')}</small>
                <div class="qbar"><i style="width:${Math.min(100,p/q.n*100)}%"></i></div></div>
                ${q.claimed ? '<span class="tag">✓</span>'
                            : `<button class="btn ${done?'':'no'}" onclick="claimQuest(${k})">забрать</button>`}
            </div>`;
        });
        const allDone = S.quests.every(q=>q.claimed);
        h += `<div class="row chest">
            <div class="ic">${ic(S.chestClaimed ? 'check' : 'chest')}</div>
            <div class="info"><b>Сундук дня</b><small>Выполни все 3 квеста · монеты + семя ${icc('seed')}</small></div>
            ${S.chestClaimed ? '<span class="tag">✓</span>'
                             : `<button class="btn ${allDone?'':'no'}" onclick="claimChest()">открыть</button>`}
        </div>`;
    }
    box.innerHTML = h;
}

// ---------- Альбом ----------
function renderAlbum() {
    for (const b of document.querySelectorAll('#albumSheet .tab'))
        b.classList.toggle('on', b.dataset.tab === albumTab);
    const box = $('albumList');
    let h = '';
    if (albumTab === 'coll') {
        h += '<div class="grid">';
        CROPS.forEach((c, i) => {
            h += S.disc[i]
                ? `<div class="cell"><div class="big">${ic(c.id)}</div><small>${c.name}</small></div>`
                : `<div class="cell dark"><div class="big"><span>?</span></div><small>???</small></div>`;
        });
        h += '</div><div class="hint">Открыто культур: ' + S.disc.filter(x=>x).length + ' / ' + CROPS.length + '</div>';
    } else {
        for (const a of ACHS) {
            const got = !!S.ach[a.id];
            const p = Math.min(S.cnt[a.cnt], a.n);
            h += `<div class="row ${got?'':'dim'}">
                <div class="ic">${ic(got?'trophy':'lock')}</div>
                <div class="info"><b>${a.name}</b><small>${a.desc} · ${got?'получено':p+'/'+a.n} · +${a.seed} ${icc('seed')}</small></div>
            </div>`;
        }
    }
    box.innerHTML = h;
}
function albumFlash() { /* хук на будущее — вспышка в альбоме */ }

// ---------- Престиж ----------
function showPrestige() {
    const p = pendingSeeds();
    $('prestigeInfo').innerHTML = `
        <p>Начни <b>новый сезон</b>: ферма, монеты и улучшения сбросятся,<br>
        а ты получишь <b class="gold">+${p} ${icc('seed')} золотых семян</b>.</p>
        <p>Каждое семя даёт <b>+10% к доходу навсегда</b>.<br>
        Сейчас у тебя ${S.seeds} ${icc('seed')} (бонус +${S.seeds*10}%).</p>
        <p><small>Заработано за сезон: ${fmt(S.seasonEarned)} ${icc('coin')}.<br>
        Следующее семя: ${fmt(SEED_BASE*Math.pow(seedsFromEarned(S.seasonEarned)+1,2))} ${icc('coin')} за сезон.</small></p>`;
    $('prestigeGo').disabled = p <= 0;
    $('prestigeGo').innerHTML = p > 0 ? icc('star') + ' Новый сезон (+' + p + ')' : 'Пока рано…';
    openModal('prestigeModal');
    sfx('click');
}

// ---------- Офлайн-модалка ----------
function showOfflineModal(pay, t) {
    $('offlineInfo').innerHTML = `Пока тебя не было (${fmtTime(t)}),<br>ферма заработала <b>${fmt(pay)} ${icc('coin')}</b>!`;
    $('offlineTake').onclick = () => { takeOffline(1); closeModal('offlineModal'); };
    $('offlineX2').onclick = () => showRewarded(() => { takeOffline(2); closeModal('offlineModal'); });
    openModal('offlineModal');
}

// ---------- Туториал ----------
const TUT_TEXT = [
    'Тапни по грядке,<br>чтобы посадить <i class="ci">' + ICONS.wheat + '</i>',
    'Подожди чуть-чуть…<br>и собери урожай!',
    'Открой склад <i class="ci">' + ICONS.barn + '</i><br>и продай урожай',
    '',
];
function renderTut() {
    const el = $('tut');
    if (S.tut >= 3) { el.style.display = 'none'; return; }
    el.style.display = '';
    $('tutText').innerHTML = TUT_TEXT[S.tut];
    posTut();
}
function posTut() {
    const el = $('tut');
    if (S.tut >= 3 || el.style.display === 'none') return;
    let x, y;
    if (S.tut <= 1) {
        const p = worldToScreen(plotPos(0).add(vec2(0, 1.1)));
        x = p.x; y = p.y;
        el.classList.remove('side');
    } else {
        const r = $('barnFab').getBoundingClientRect();
        x = r.left - 10; y = r.top + r.height/2;
        el.classList.add('side');
    }
    el.style.left = Math.max(95, Math.min(innerWidth-95, x)) + 'px';
    el.style.top  = Math.max(30, y) + 'px';
}

// ---------- Тост ----------
let toastT = null;
function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 2200);
}
