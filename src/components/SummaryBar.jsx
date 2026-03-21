export default function SummaryBar({ children }) {
  return (
    <div className="mt-4 px-4 py-3 bg-brand/5 border-l-[3px] border-brand rounded-r-lg font-serif text-sm text-foreground/80 italic">
      {children}
    </div>
  );
}
