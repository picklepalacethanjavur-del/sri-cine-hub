"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationProgress(){
  const pathname=usePathname();
  const searchParams=useSearchParams();
  const [active,setActive]=useState(false);
  const [progress,setProgress]=useState(0);
  const timer=useRef<ReturnType<typeof setInterval>|null>(null);

  function start(){
    setActive(true);
    setProgress(p=>p>0?p:12);
  }

  function stop(){
    setProgress(100);
    window.setTimeout(()=>{
      setActive(false);
      setProgress(0);
    },180);
  }

  useEffect(()=>{
    const onClick=(event:MouseEvent)=>{
      if(event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target=event.target as Element|null;
      const anchor=target?.closest?.("a[href]") as HTMLAnchorElement|null;
      if(!anchor || anchor.target==="_blank" || anchor.hasAttribute("download")) return;
      const href=anchor.getAttribute("href");
      if(!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;
      const url=new URL(anchor.href,window.location.href);
      if(url.origin!==window.location.origin) return;
      const current=window.location.pathname+window.location.search;
      const next=url.pathname+url.search;
      if(next===current) return;
      start();
    };
    const onPop=()=>start();
    document.addEventListener("click",onClick,true);
    window.addEventListener("popstate",onPop);
    return ()=>{
      document.removeEventListener("click",onClick,true);
      window.removeEventListener("popstate",onPop);
    };
  },[]);

  useEffect(()=>{
    if(!active) return;
    timer.current=setInterval(()=>{
      setProgress(p=>{
        if(p>=88) return p;
        const jump=p<40?9:p<70?5:2;
        return Math.min(88,p+jump);
      });
    },180);
    return ()=>{ if(timer.current) clearInterval(timer.current); };
  },[active]);

  useEffect(()=>{
    if(active) stop();
    // route completion signal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pathname,searchParams.toString()]);

  return active?<div className="navProgressTrack" aria-hidden="true"><div className="navProgressBar" style={{width:`${progress}%`}}/></div>:null;
}
