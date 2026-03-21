import { useState } from "react";

export default function Tip({ text }) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex ml-1.5"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.stopPropagation(); setShow(!show); }}
    >
      <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground cursor-help">
        ?
      </span>
      {show && (
        <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50 w-56 px-3.5 py-2.5 rounded-xl bg-popover border border-border shadow-xl text-xs text-popover-foreground leading-relaxed animate-fade-in">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-border" />
        </div>
      )}
    </span>
  );
}
