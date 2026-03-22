import { useState, useEffect, useMemo } from "react";
import { fmt } from "../lib/tokens";
import { useIsMobile, useAuth } from "../lib/hooks";
import { loadProperties, loadCustomFields, getLandmarks, getWorkplaceAddress } from "../lib/supabase";
import { DistanceMatrixModal } from "./MapView";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Dialog, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "../components/ui/dialog";
import { Select } from "../components/ui/select";
import { Input } from "../components/ui/input";

// ─── Standard column definitions ─────────────────────────────────────────────
const STANDARD_COLS = [
  { key: "photo",         label: "Photo",   sortKey: null },
  { key: "property_type", label: "Type",    sortKey: null },
  { key: "location",      label: "Location",sortKey: "location" },
  { key: "price",         label: "Price",   sortKey: "price" },
  { key: "bedrooms",      label: "Beds",    sortKey: "beds" },
  { key: "bathrooms",     label: "Baths",   sortKey: "baths" },
  { key: "size",          label: "Size",    sortKey: "size" },
  { key: "website_link",  label: "Link",    sortKey: null },
  { key: "notes",         label: "Notes",   sortKey: null },
  { key: "created_at",    label: "Added",   sortKey: "date" },
];

const DEFAULT_HIDDEN_COLS = new Set(["photo", "website_link", "notes"]);

// ─── Checkbox ─────────────────────────────────────────────────────────────────
function Check({ checked, onChange }) {
  return (
    <div
      onClick={onChange}
      className={cn(
        "w-4 h-4 shrink-0 cursor-pointer flex items-center justify-center transition-colors",
        checked
          ? "bg-foreground border-foreground border-[1.5px]"
          : "bg-transparent border-border border-[1.5px]"
      )}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-background">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
}

// ─── Customise dialog ─────────────────────────────────────────────────────────
function CustomiseDialog({
  standardCols, customFields,
  hiddenCols, onHiddenColsChange,
  allProperties, hiddenProps, onHiddenPropsChange,
  onClose,
}) {
  const [localCols, setLocalCols]   = useState(new Set(hiddenCols));
  const [localProps, setLocalProps] = useState(new Set(hiddenProps));

  const toggleCol  = (k) => setLocalCols(s  => { const n = new Set(s); n.has(k)  ? n.delete(k)  : n.add(k);  return n; });
  const toggleProp = (k) => setLocalProps(s => { const n = new Set(s); n.has(k)  ? n.delete(k)  : n.add(k);  return n; });

  const apply = () => { onHiddenColsChange(localCols); onHiddenPropsChange(localProps); onClose(); };

  const SHead = ({ children }) => (
    <div className="text-[9px] tracking-[0.2em] uppercase font-bold text-brand border-b border-border pb-2 mb-3.5">
      {children}
    </div>
  );

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <DialogHeader onClose={onClose}>
        <DialogTitle className="text-xl font-normal">Customise View</DialogTitle>
      </DialogHeader>

      <DialogBody className="space-y-7">
        {/* Standard columns */}
        <div>
          <SHead>Standard Columns</SHead>
          <div className="grid grid-cols-2 gap-2.5">
            {standardCols.map(col => (
              <label key={col.key} className="flex items-center gap-2.5 cursor-pointer">
                <Check checked={!localCols.has(col.key)} onChange={() => toggleCol(col.key)} />
                <span className="text-sm text-foreground">{col.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Custom fields */}
        {customFields.length > 0 && (
          <div>
            <SHead>Custom Fields</SHead>
            <div className="grid grid-cols-2 gap-2.5">
              {customFields.map(f => (
                <label key={f.id} className="flex items-center gap-2.5 cursor-pointer">
                  <Check checked={!localCols.has(`cf_${f.id}`)} onChange={() => toggleCol(`cf_${f.id}`)} />
                  <span className="text-sm text-foreground">
                    {f.name}
                    <span className="text-[10px] text-muted-foreground ml-1">({f.field_type})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Properties */}
        {allProperties.length > 0 && (
          <div>
            <SHead>Properties Shown</SHead>
            <div className="flex flex-col gap-[9px]">
              {allProperties.map(p => (
                <label key={p.id} className="flex items-center gap-2.5 cursor-pointer">
                  <Check checked={!localProps.has(p.id)} onChange={() => toggleProp(p.id)} />
                  <span className="text-sm text-foreground flex-1">{p.name}</span>
                  {p.location && (
                    <span className="text-[11px] text-muted-foreground">{p.location}</span>
                  )}
                  <span className="text-[11px] text-muted-foreground min-w-[60px] text-right">
                    {p.price ? fmt(p.price) : "—"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="default" size="sm" onClick={apply}>Apply</Button>
      </DialogFooter>
    </Dialog>
  );
}

// ─── Sort / filter bar ────────────────────────────────────────────────────────
function SortFilterBar({ customFields, sortBy, onSort, filters, onFilter }) {
  const [open, setOpen] = useState(false);
  const rankingFields = customFields.filter(f => f.field_type === "ranking");
  const numberFields  = customFields.filter(f => f.field_type === "number" || f.field_type === "cost");

  const sortOptions = [
    { value: "date_desc",  label: "Newest first" },
    { value: "date_asc",   label: "Oldest first" },
    { value: "price_asc",  label: "Price ↑" },
    { value: "price_desc", label: "Price ↓" },
    { value: "beds_asc",   label: "Beds ↑" },
    { value: "beds_desc",  label: "Beds ↓" },
    { value: "baths_asc",  label: "Baths ↑" },
    { value: "baths_desc", label: "Baths ↓" },
    { value: "size_asc",   label: "Size ↑" },
    { value: "size_desc",  label: "Size ↓" },
    ...rankingFields.flatMap(f => [
      { value: `rank_${f.id}_desc`, label: `${f.name} ↓` },
      { value: `rank_${f.id}_asc`,  label: `${f.name} ↑` },
    ]),
  ];

  const hasFilters = Object.values(filters).some(v => v !== "" && v !== undefined);

  return (
    <div className="mb-4">
      <div className="flex gap-2 items-center flex-wrap">
        <Select
          value={sortBy}
          onChange={e => onSort(e.target.value)}
          className="w-auto text-[11px]"
        >
          {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>

        <Button
          variant={open ? "default" : "outline"}
          size="sm"
          onClick={() => setOpen(v => !v)}
        >
          Filters {open ? "▴" : "▾"}
        </Button>

        {hasFilters && (
          <button
            onClick={() => onFilter({})}
            className="text-[10px] bg-transparent border-none text-brand cursor-pointer font-semibold"
          >
            Clear filters
          </button>
        )}
      </div>

      {open && (
        <div className="flex gap-4 flex-wrap mt-2.5 px-4 py-3 bg-card border border-border/50 rounded-lg">
          {[["Min beds", "minBeds"], ["Max beds", "maxBeds"], ["Max price £", "maxPrice"]].map(([label, key]) => (
            <div key={key}>
              <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-1">{label}</div>
              <Input
                type="number"
                min={0}
                value={filters[key] || ""}
                onChange={e => onFilter({ ...filters, [key]: e.target.value })}
                className="w-20 h-8 text-xs"
              />
            </div>
          ))}
          {numberFields.map(f => (
            <div key={f.id}>
              <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-1">Min {f.name}</div>
              <Input
                type="number"
                min={0}
                value={filters[`num_${f.id}`] || ""}
                onChange={e => onFilter({ ...filters, [`num_${f.id}`]: e.target.value })}
                className="w-20 h-8 text-xs"
              />
            </div>
          ))}
          {rankingFields.map(f => (
            <div key={f.id}>
              <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-muted-foreground mb-1">Min {f.name}</div>
              <Input
                type="number"
                min={1}
                max={10}
                value={filters[`rank_${f.id}`] || ""}
                onChange={e => onFilter({ ...filters, [`rank_${f.id}`]: e.target.value })}
                className="w-20 h-8 text-xs"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Standard cell renderer ───────────────────────────────────────────────────
function StdCell({ colKey, property: p }) {
  if (colKey === "photo") {
    if (!p.photo_url) return <span className="text-muted-foreground text-xs">—</span>;
    return <img src={p.photo_url} alt="" className="w-12 h-10 object-cover block" />;
  }
  if (colKey === "property_type") {
    return <span className="text-xs">{p.property_type === "house" ? "House" : "Apartment"}</span>;
  }
  if (colKey === "location") {
    return <span className="text-xs text-muted-foreground">{p.location || "—"}</span>;
  }
  if (colKey === "price") {
    return (
      <span className="text-sm font-bold text-foreground">
        {p.price ? fmt(p.price) : "—"}
      </span>
    );
  }
  if (colKey === "bedrooms") {
    return <span className="text-[13px] font-semibold">{p.bedrooms ?? "—"}</span>;
  }
  if (colKey === "bathrooms") {
    return <span className="text-[13px]">{p.bathrooms ?? "—"}</span>;
  }
  if (colKey === "size") {
    if (!p.size) return <span className="text-muted-foreground text-xs">—</span>;
    return (
      <span className="text-xs">
        {Number(p.size).toLocaleString("en-GB")} {p.size_unit || "sqft"}
      </span>
    );
  }
  if (colKey === "website_link") {
    if (!p.website_link) return <span className="text-muted-foreground text-xs">—</span>;
    let domain = "";
    try { domain = new URL(p.website_link).hostname; } catch {}
    return (
      <a href={p.website_link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 no-underline">
        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} width={14} height={14} alt="" className="block" />
        <span className="text-[11px] text-brand">View</span>
      </a>
    );
  }
  if (colKey === "notes") {
    return (
      <span className="text-xs text-muted-foreground italic max-w-[200px] block overflow-hidden text-ellipsis whitespace-nowrap">
        {p.notes || "—"}
      </span>
    );
  }
  if (colKey === "created_at") {
    return (
      <span className="text-[11px] text-muted-foreground">
        {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
      </span>
    );
  }
  return null;
}

// ─── Custom field cell renderer ───────────────────────────────────────────────
function CfCell({ field, property }) {
  const val = property.custom_values?.[field.id];

  if (field.field_type === "checkbox") {
    const checked = !!val;
    return (
      <span className={cn("text-[15px] font-semibold", checked ? "text-green-600" : "text-muted-foreground")}>
        {checked ? "✓" : "✗"}
      </span>
    );
  }
  if (field.field_type === "ranking") {
    const v = val || 0;
    return (
      <div className="flex items-center gap-2 min-w-[90px]">
        <div className="flex-1 h-1 bg-border relative max-w-[60px]">
          <div className="absolute left-0 top-0 h-full bg-brand" style={{ width: `${v * 10}%` }} />
        </div>
        <span className={cn("text-xs font-semibold min-w-[18px]", v > 0 ? "text-foreground" : "text-muted-foreground")}>
          {v > 0 ? v : "—"}
        </span>
      </div>
    );
  }
  if (field.field_type === "number") {
    return (
      <span className="text-[13px] font-semibold">
        {val !== undefined && val !== "" && val !== null ? Number(val).toLocaleString("en-GB") : "—"}
      </span>
    );
  }
  if (field.field_type === "maybe") {
    const colorMap = { yes: "text-green-600", maybe: "text-amber-500", no: "text-red-500" };
    const strVal = typeof val === "string" ? val : null;
    return strVal
      ? <span className={cn("text-xs font-bold uppercase tracking-[0.04em]", colorMap[strVal] || "text-muted-foreground")}>{strVal}</span>
      : <span className="text-muted-foreground">—</span>;
  }
  if (field.field_type === "distance") {
    const hasVal = val && typeof val === "object" && val.n !== "" && val.n != null;
    return (
      <span className="text-[13px] font-semibold">
        {hasVal ? `${val.n} ${val.u || "mi"}` : "—"}
      </span>
    );
  }
  if (field.field_type === "cost") {
    return (
      <span className="text-[13px] font-semibold">
        {val !== undefined && val !== "" && val !== null ? `£${Number(val).toLocaleString("en-GB")}` : "—"}
      </span>
    );
  }
  if (field.field_type === "location") {
    // location fields are address strings used by the commute section; show as plain text
    const locName = val && typeof val === "object" ? val.name : (typeof val === "string" ? val : null);
    return (
      <span className="text-xs text-muted-foreground max-w-[140px] block overflow-hidden text-ellipsis whitespace-nowrap">
        {locName || "—"}
      </span>
    );
  }
  if (field.field_type?.startsWith("nearest")) {
    // nearest landmark — show name + shortest travel time
    if (!val || typeof val !== "object" || !val.name) return <span className="text-muted-foreground">—</span>;
    const times = [val.walk, val.drive, val.cycle, val.transit].filter(Boolean);
    return (
      <span className="text-xs text-muted-foreground max-w-[160px] block overflow-hidden text-ellipsis whitespace-nowrap" title={times.length ? times.join(" · ") : ""}>
        {val.name}{times.length > 0 && <span className="text-[10px] ml-1 text-foreground/60">({times[0]})</span>}
      </span>
    );
  }
  // text (default) — guard against objects being stored in unexpected field types
  const displayVal = val !== null && typeof val === "object" ? null : val;
  return (
    <span className="text-xs text-muted-foreground max-w-[140px] block overflow-hidden text-ellipsis whitespace-nowrap">
      {displayVal || "—"}
    </span>
  );
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────
const COL_SORT_KEYS = {
  price:    { asc: "price_asc",  desc: "price_desc" },
  bedrooms: { asc: "beds_asc",   desc: "beds_desc" },
  bathrooms:{ asc: "baths_asc",  desc: "baths_desc" },
  size:     { asc: "size_asc",   desc: "size_desc" },
  created_at:{ asc: "date_asc", desc: "date_desc" },
  location: { asc: "location_asc", desc: "location_desc" },
};

function sortList(list, sortBy, customFields) {
  return [...list].sort((a, b) => {
    if (sortBy === "date_asc")     return new Date(a.created_at) - new Date(b.created_at);
    if (sortBy === "date_desc")    return new Date(b.created_at) - new Date(a.created_at);
    if (sortBy === "price_asc")    return (a.price || 0) - (b.price || 0);
    if (sortBy === "price_desc")   return (b.price || 0) - (a.price || 0);
    if (sortBy === "beds_asc")     return (a.bedrooms || 0) - (b.bedrooms || 0);
    if (sortBy === "beds_desc")    return (b.bedrooms || 0) - (a.bedrooms || 0);
    if (sortBy === "baths_asc")    return (a.bathrooms || 0) - (b.bathrooms || 0);
    if (sortBy === "baths_desc")   return (b.bathrooms || 0) - (a.bathrooms || 0);
    if (sortBy === "size_asc")     return (a.size || 0) - (b.size || 0);
    if (sortBy === "size_desc")    return (b.size || 0) - (a.size || 0);
    if (sortBy === "location_asc") return (a.location || "").localeCompare(b.location || "");
    if (sortBy === "location_desc")return (b.location || "").localeCompare(a.location || "");
    if (sortBy.startsWith("rank_")) {
      const m = sortBy.match(/rank_(.+)_(asc|desc)/);
      if (m) {
        const [, fieldId, dir] = m;
        const av = a.custom_values?.[fieldId] || 0, bv = b.custom_values?.[fieldId] || 0;
        return dir === "desc" ? bv - av : av - bv;
      }
    }
    if (sortBy.startsWith("cfnum_")) {
      const m = sortBy.match(/cfnum_(.+)_(asc|desc)/);
      if (m) {
        const [, fieldId, dir] = m;
        const av = Number(a.custom_values?.[fieldId]) || 0;
        const bv = Number(b.custom_values?.[fieldId]) || 0;
        return dir === "desc" ? bv - av : av - bv;
      }
    }
    return 0;
  });
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PropertyComparison() {
  const { user }  = useAuth();
  const mobile    = useIsMobile();

  const [properties,   setProperties]   = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState("rent");
  const [sortBy,       setSortBy]       = useState("date_desc");
  const [filters,      setFilters]      = useState({});
  const [showDialog,   setShowDialog]   = useState(false);
  const [hiddenProps,  setHiddenProps]  = useState(new Set());
  const [showDistMatrix, setShowDistMatrix] = useState(false);
  const landmarks = useMemo(() => getLandmarks(user), [user]);
  const workplaceAddress = getWorkplaceAddress(user);

  // Persist column visibility in localStorage
  const [hiddenCols, setHiddenColsRaw] = useState(() => {
    try {
      const s = localStorage.getItem("pc_hidden_cols");
      return s ? new Set(JSON.parse(s)) : new Set(DEFAULT_HIDDEN_COLS);
    } catch { return new Set(DEFAULT_HIDDEN_COLS); }
  });
  const setHiddenCols = (next) => {
    setHiddenColsRaw(next);
    try { localStorage.setItem("pc_hidden_cols", JSON.stringify([...next])); } catch {}
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([loadProperties(), loadCustomFields()]).then(([pRes, cfRes]) => {
      setProperties(pRes.data || []);
      setCustomFields(cfRes.data || []);
      setLoading(false);
    });
  }, [user]);

  // All properties for current tab (before any filter/hide)
  const tabProperties = useMemo(
    () => properties.filter(p => p.listing_type === activeTab),
    [properties, activeTab]
  );

  // Apply hidden-props, then filters, then sort
  const displayed = useMemo(() => {
    let list = tabProperties.filter(p => !hiddenProps.has(p.id));

    if (filters.minBeds)  list = list.filter(p => p.bedrooms >= Number(filters.minBeds));
    if (filters.maxBeds)  list = list.filter(p => p.bedrooms <= Number(filters.maxBeds));
    if (filters.maxPrice) list = list.filter(p => !p.price || p.price <= Number(filters.maxPrice));
    customFields.forEach(f => {
      if ((f.field_type === "number" || f.field_type === "cost")  && filters[`num_${f.id}`])  list = list.filter(p => (p.custom_values?.[f.id]  || 0) >= Number(filters[`num_${f.id}`]));
      if (f.field_type === "ranking" && filters[`rank_${f.id}`]) list = list.filter(p => (p.custom_values?.[f.id]  || 0) >= Number(filters[`rank_${f.id}`]));
    });

    return sortList(list, sortBy, customFields);
  }, [tabProperties, hiddenProps, filters, sortBy, customFields]);

  // Visible columns
  const visibleStdCols = STANDARD_COLS.filter(c => !hiddenCols.has(c.key));
  const visibleCfCols  = customFields.filter(f => !hiddenCols.has(`cf_${f.id}`));

  // Column-header sort click
  const handleColHeaderClick = (colKey, cfField) => {
    if (cfField) {
      const fieldType = cfField.field_type;
      if (fieldType !== "ranking" && fieldType !== "number" && fieldType !== "cost") return;
      const prefix = fieldType === "ranking" ? "rank" : "cfnum";
      const descKey = `${prefix}_${cfField.id}_desc`;
      const ascKey  = `${prefix}_${cfField.id}_asc`;
      setSortBy(prev => prev === descKey ? ascKey : descKey);
      return;
    }
    const map = COL_SORT_KEYS[colKey];
    if (!map) return;
    setSortBy(prev => prev === map.desc ? map.asc : map.desc);
  };

  const getSortIndicator = (colKey, cfField) => {
    if (cfField) {
      const prefix = cfField.field_type === "ranking" ? "rank" : "cfnum";
      if (sortBy === `${prefix}_${cfField.id}_desc`) return " ↓";
      if (sortBy === `${prefix}_${cfField.id}_asc`)  return " ↑";
      return "";
    }
    const map = COL_SORT_KEYS[colKey];
    if (!map) return "";
    if (sortBy === map.desc) return " ↓";
    if (sortBy === map.asc)  return " ↑";
    return "";
  };

  const isSortable = (colKey, cfField) => {
    if (cfField) return cfField.field_type === "ranking" || cfField.field_type === "number" || cfField.field_type === "cost";
    return !!COL_SORT_KEYS[colKey];
  };

  if (!user) {
    return (
      <div className={cn("text-center pt-24", mobile ? "px-4 py-8" : "px-8 py-12")}>
        <h1 className="text-5xl font-normal text-foreground uppercase tracking-[0.04em] mb-4" style={{ WebkitTextStroke: "1.5px currentColor", WebkitTextFillColor: "transparent" }}>Comparison</h1>
        <p className="text-muted-foreground italic">Sign in to compare properties.</p>
      </div>
    );
  }

  const hiddenColCount = hiddenCols.size;
  const hiddenPropCount = hiddenProps.size;

  return (
    <div className={cn(mobile ? "px-4 py-8" : "px-8 py-12")}>
      {/* Header */}
      <div className="flex items-end justify-between mb-7 flex-wrap gap-3">
        <div>
          <h1
            className={cn(
              "font-normal text-foreground uppercase tracking-[0.04em] mb-1.5",
              mobile ? "text-3xl" : "text-5xl"
            )}
            style={{ WebkitTextStroke: "1.5px currentColor", WebkitTextFillColor: "transparent" }}
          >
            Comparison
          </h1>
          <p className="text-muted-foreground italic m-0 text-sm">
            Side-by-side matrix of all your tracked properties.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={() => setShowDistMatrix(true)}
            className="rounded-full uppercase tracking-[0.06em] whitespace-nowrap gap-2"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            Distances
          </Button>
          <Button
            variant="default"
            size="md"
            onClick={() => setShowDialog(true)}
            className="rounded-full uppercase tracking-[0.06em] whitespace-nowrap gap-2"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            Customise
            {(hiddenColCount > 0 || hiddenPropCount > 0) && (
              <span className="bg-background text-foreground text-[9px] font-bold px-1.5 py-px rounded-full">
                {hiddenColCount + hiddenPropCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs + count */}
      <div className="flex items-center gap-0 mb-5 border-b-[1.5px] border-border">
        {[{ key: "rent", label: "Renting" }, { key: "buy", label: "Buying" }].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "px-6 py-2.5 border-none -mb-px cursor-pointer text-[13px] bg-transparent transition-colors",
              activeTab === t.key
                ? "border-b-[3px] border-brand text-foreground font-semibold"
                : "border-b-[3px] border-transparent text-muted-foreground font-normal"
            )}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground self-center pr-0.5 tracking-[0.08em] uppercase font-semibold">
          {displayed.length} / {tabProperties.length}
        </span>
      </div>

      {/* Sort / filter bar */}
      <SortFilterBar
        customFields={customFields}
        sortBy={sortBy} onSort={setSortBy}
        filters={filters} onFilter={setFilters}
      />

      {/* Empty states */}
      {loading && (
        <div className="text-muted-foreground italic">Loading…</div>
      )}

      {!loading && tabProperties.length === 0 && (
        <div className="px-6 py-12 border-[1.5px] border-dashed border-border rounded-lg text-center">
          <p className="text-muted-foreground italic m-0">
            No {activeTab} properties yet. Add some in Gaff Tracker to compare them here.
          </p>
        </div>
      )}

      {!loading && tabProperties.length > 0 && displayed.length === 0 && (
        <div className="px-6 py-12 border-[1.5px] border-dashed border-border rounded-lg text-center">
          <p className="text-muted-foreground italic m-0">
            No properties match the current filters or visibility settings.{" "}
            {hiddenPropCount > 0 && (
              <span>
                <button
                  onClick={() => setShowDialog(true)}
                  className="bg-none border-none text-brand cursor-pointer italic text-[length:inherit] underline"
                >
                  Open Customise
                </button>
                {" "}to show hidden properties.
              </span>
            )}
          </p>
        </div>
      )}

      {/* Matrix table */}
      {!loading && displayed.length > 0 && (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {/* Sticky name header */}
                <th className="px-4 py-3 text-left sticky top-0 left-0 z-[3] bg-muted text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap min-w-[180px] border-r border-border border-b-[1.5px]">
                  Property
                </th>

                {/* Standard columns */}
                {visibleStdCols.map(col => {
                  const sortable = isSortable(col.key, null);
                  const indicator = getSortIndicator(col.key, null);
                  return (
                    <th
                      key={col.key}
                      onClick={sortable ? () => handleColHeaderClick(col.key, null) : undefined}
                      className={cn(
                        "px-4 py-3 text-left sticky top-0 z-[2] bg-muted text-[10px] uppercase tracking-widest font-semibold whitespace-nowrap border-b-[1.5px] border-border select-none",
                        sortable ? "cursor-pointer" : "cursor-default",
                        indicator ? "text-brand" : "text-muted-foreground"
                      )}
                    >
                      {col.label}{indicator}
                    </th>
                  );
                })}

                {/* Custom field columns */}
                {visibleCfCols.map(f => {
                  const sortable = isSortable(null, f);
                  const indicator = getSortIndicator(null, f);
                  return (
                    <th
                      key={f.id}
                      onClick={sortable ? () => handleColHeaderClick(null, f) : undefined}
                      className={cn(
                        "px-4 py-3 text-left sticky top-0 z-[2] bg-muted text-[10px] uppercase tracking-widest font-semibold whitespace-nowrap border-b-[1.5px] border-border select-none",
                        sortable ? "cursor-pointer" : "cursor-default",
                        indicator ? "text-brand" : "text-muted-foreground"
                      )}
                    >
                      {f.name}{indicator}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayed.map((p, i) => (
                <tr key={p.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                  {/* Sticky name cell */}
                  <td className={cn(
                    "px-4 py-3 sticky left-0 z-10 min-w-[180px] border-r border-border",
                    i % 2 === 0 ? "bg-card" : "bg-muted/30"
                  )}>
                    <div className="flex flex-col gap-0.5">
                      {p.photo_url && (
                        <img src={p.photo_url} alt="" className="w-12 h-9 object-cover block mb-1 rounded" />
                      )}
                      <span className="text-sm text-foreground leading-tight">{p.name}</span>
                      {p.location && (
                        <span className="text-[10px] text-muted-foreground">{p.location}</span>
                      )}
                    </div>
                  </td>

                  {/* Standard column cells */}
                  {visibleStdCols.map(col => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-foreground align-middle",
                        i % 2 === 0 ? "bg-card" : "bg-muted/30"
                      )}
                    >
                      <StdCell colKey={col.key} property={p} />
                    </td>
                  ))}

                  {/* Custom field cells */}
                  {visibleCfCols.map(f => (
                    <td
                      key={f.id}
                      className={cn(
                        "px-4 py-3 text-foreground align-middle",
                        i % 2 === 0 ? "bg-card" : "bg-muted/30"
                      )}
                    >
                      <CfCell field={f} property={p} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customise dialog */}
      {showDialog && (
        <CustomiseDialog
          standardCols={STANDARD_COLS}
          customFields={customFields}
          hiddenCols={hiddenCols}
          onHiddenColsChange={setHiddenCols}
          allProperties={tabProperties}
          hiddenProps={hiddenProps}
          onHiddenPropsChange={setHiddenProps}
          onClose={() => setShowDialog(false)}
        />
      )}
      {showDistMatrix && (
        <DistanceMatrixModal
          properties={properties}
          initialProperty={null}
          landmarks={landmarks}
          workplaceAddress={workplaceAddress}
          onClose={() => setShowDistMatrix(false)}
        />
      )}
    </div>
  );
}
