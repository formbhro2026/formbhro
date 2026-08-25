import logoAsset from "@/assets/logo.png.asset.json";
import { useState } from "react";

export function Logo({ className = "h-8 w-auto" }: { className?: string }) {
  const [imgError, setImgError] = useState(false);

  return (
    <a 
      href="/" 
      onClick={(e) => {
        if (window.location.pathname === "/") {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }}
      className="flex items-center gap-2" 
      aria-label="Formbhro home"
    >
      {!imgError ? (
        <img 
          src={logoAsset.url} 
          alt="Formbhro" 
          width={140} 
          height={40} 
          loading="eager"
          decoding="async" 
          fetchPriority="high" 
          onError={() => setImgError(true)}
          className={className} 
        />
      ) : (
        <span className="flex items-center gap-1.5 font-black text-xl tracking-tight text-white select-none">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white text-xs font-black shadow-md shadow-brand/30">
            ✓
          </span>
          <span>FORM<span className="text-brand">BHRO</span></span>
        </span>
      )}
    </a>
  );
}
