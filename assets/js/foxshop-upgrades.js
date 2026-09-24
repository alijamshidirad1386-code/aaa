/* PetraPet visual layer: seven-color typography, brand polish and no quiz/account/review UI. */
(() => {
  'use strict';
  if (window.__PETRAPET_THEME__) return;
  window.__PETRAPET_THEME__ = true;

  const COLORS = ['#72d6bd','#6fe1dd','#8bd2ff','#ff9b9b','#ffc27d','#c7a8ff','#ffe58b'];
  let tintIndex = 0;
  const hash = (text) => {
    let h = 0;
    for (let i=0;i<text.length;i++) h=((h<<5)-h)+text.charCodeAt(i)|0;
    return Math.abs(h);
  };
  const ignored = new Set(['SCRIPT','STYLE','NOSCRIPT','OPTION','TITLE']);

  function colorizeVisibleText(){
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT);
    let el;
    while((el=walker.nextNode())){
      if(ignored.has(el.tagName)) continue;
      if(el.matches('input,textarea,select,svg,[aria-hidden="true"],.fa-solid,.fa-regular,.fa-brands,.material-icons')) continue;
      const direct=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim());
      if(!direct.length) continue;
      if(!el.offsetParent && el.tagName!=='BODY') continue;
      const text=direct.map(n=>n.textContent.trim()).join(' ');
      if(!text || text.length<1) continue;
      const idx=(hash(text)+tintIndex++)%COLORS.length;
      el.style.setProperty('--petra-color', COLORS[idx]);
      el.setAttribute('data-petra-rainbow','1');
    }
    // Keep brand marks legible while still following the black-outline rule.
    document.querySelectorAll('.petra-brand,.brand-logo-trigger img').forEach(x=>x.style.setProperty('--petra-color','#17232b'));
  }

  function cleanLegacyArtifacts(){
  }

  function init(){
    cleanLegacyArtifacts();
    colorizeVisibleText();
    const obs=new MutationObserver(()=>{
      clearTimeout(window.__PETRAPET_RAINBOW_TIMER__);
      window.__PETRAPET_RAINBOW_TIMER__=setTimeout(()=>{cleanLegacyArtifacts();colorizeVisibleText();},80);
    });
    obs.observe(document.body,{subtree:true,childList:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
