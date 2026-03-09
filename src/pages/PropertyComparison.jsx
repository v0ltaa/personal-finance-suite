import { useState, useEffect, useMemo } from "react";
import { C, fonts, fmt } from "../lib/tokens";
import { useIsMobile, useAuth } from "../lib/hooks";
import { loadProperties, loadCustomFields } from "../lib/supabase";

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
      style={{
        width: 16, height: 16, flexShrink: 0, cursor: "pointer",
        border: `1.5px solid ${checked ? C.text : C.border}`,
        background: checked ? C.text : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
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
    <div style={{
      fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700,
      fontFamily: fonts.sans, color: C.accent,
      borderBottom: `1px solid ${C.border}`, paddingBottom: 8, marginBottom: 14,
    }}>
      {children}
    </div>
  );

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div style={{
        background: C.card, maxWidth: 580, width: "100%", maxHeight: "88vh",
        overflowY: "auto", padding: "32px 36px", position: "relative",
      }}>
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 16, right: 20, background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMid, lineHeight: 1 }}
        >×</button>

        <h3 style={{ fontFamily: fonts.serif, fontWeight: 400, fontSize: 22, margin: "0 0 28px" }}>Customise View</h3>

        {/* Standard columns */}
        <div style={{ marginBottom: 28 }}>
          <SHead>Standard Columns</SHead>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {standardCols.map(col => (
              <label key={col.key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <Check checked={!localCols.has(col.key)} onChange={() => toggleCol(col.key)} />
                <span style={{ fontFamily: fonts.sans, fontSize: 13, color: C.text }}>{col.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Custom fields */}
        {customFields.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SHead>Custom Fields</SHead>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {customFields.map(f => (
                <label key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <Check checked={!localCols.has(`cf_${f.id}`)} onChange={() => toggleCol(`cf_${f.id}`)} />
                  <span style={{ fontFamily: fonts.sans, fontSize: 13, color: C.text }}>
                    {f.name}
                    <span style={{ fontSize: 10, color: C.textFaint, marginLeft: 4 }}>({f.field_type})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Properties */}
        {allProperties.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SHead>Properties Shown</SHead>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {allProperties.map(p => (
                <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <Check checked={!localProps.has(p.id)} onChange={() => toggleProp(p.id)} />
                  <span style={{ fontFamily: fonts.sans, fontSize: 13, color: C.text, flex: 1 }}>{p.name}</span>
                  {p.location && (
                    <span style={{ fontSize: 11, color: C.textFaint, fontFamily: fonts.sans }}>{p.location}</span>
                  )}
                  <span style={{ fontSize: 11, fontFamily: fonts.sans, color: C.textMid, minWidth: 60, textAlign: "right" }}>
                    {p.price ? fmt(p.price) : "—"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 20px", border: `1.5px solid ${C.border}`, background: "transparent", color: C.textMid, fontFamily: fonts.sans, fontSize: 12, cursor: "pointer" }}
          >Cancel</button>
          <button
            onClick={apply}
            style={{ padding: "8px 24px", border: "none", background: C.text, color: C.bg, fontFamily: fonts.sans, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >Apply</button>
        </div>
      </div>
    </div>
  );
}

// ─── Sort / filter bar ────────────────────────────────────────────────────────
function SortFilterBar({ customFields, sortBy, onSort, filters, onFilter }) {
  const [open, setOpen] = useState(false);
  const rankingFields = customFields.filter(f => f.field_type === "ranking");
  const numberFields  = customFields.filter(f => f.field_type === "number");

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

  const inputStyle = {
    border: `1.5px solid ${C.border}`, background: C.card, padding: "5px 8px",
    fontFamily: fonts.sans, fontSize: 12, color: C.text, outline: "none", width: 80,
  };
  const hasFilters = Object.values(filters).some(v => v !== "" && v !== undefined);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={sortBy}
          onChange={e => onSort(e.target.value)}
          style={{ border: `1.5px solid ${C.border}`, background: C.card, padding: "6px 10px", fontFamily: fonts.sans, fontSize: 11, color: C.text, outline: "none", cursor: "pointer" }}
        >
          {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button
          onClick={() => setOpen(v => !v)}
          style={{
            padding: "6px 12px", border: `1.5px solid ${open ? C.text : C.border}`,
            background: open ? C.text : "transparent", color: open ? C.bg : C.textMid,
            fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: fonts.sans,
          }}
        >
          Filters {open ? "▴" : "▾"}
        </button>

        {hasFilters && (
          <button
            onClick={() => onFilter({})}
            style={{ fontSize: 10, background: "transparent", border: "none", color: C.accent, cursor: "pointer", fontFamily: fonts.sans, fontWeight: 600 }}
          >Clear filters</button>
        )}
      </div>

      {open && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, padding: "12px 16px", background: C.card, border: `1px solid ${C.borderLight}` }}>
          {[["Min beds", "minBeds"], ["Max beds", "maxBeds"], ["Max price £", "maxPrice"]].map(([label, key]) => (
            <div key={key}>
              <div style={{ fontSize: 9, fontFamily: fonts.sans, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textLight, marginBottom: 4 }}>{label}</div>
              <input type="number" min={0} value={filters[key] || ""} onChange={e => onFilter({ ...filters, [key]: e.target.value })} style={inputStyle} />
            </div>
          ))}
          {numberFields.map(f => (
            <div key={f.id}>
              <div style={{ fontSize: 9, fontFamily: fonts.sans, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textLight, marginBottom: 4 }}>Min {f.name}</div>
              <input type="number" min={0} value={filters[`num_${f.id}`] || ""} onChange={e => onFilter({ ...filters, [`num_${f.id}`]: e.target.value })} style={inputStyle} />
            </div>
          ))}
          {rankingFields.map(f => (
            <div key={f.id}>
              <div style={{ fontSize: 9, fontFamily: fonts.sans, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textLight, marginBottom: 4 }}>Min {f.name}</div>
              <input type="number" min={1} max={10} value={filters[`rank_${f.id}`] || ""} onChange={e => onFilter({ ...filters, [`rank_${f.id}`]: e.target.value })} style={inputStyle} />
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
    if (!p.photo_url) return <span style={{ color: C.textFaint, fontSize: 12 }}>—</span>;
    return <img src={p.photo_url} alt="" style={{ width: 52, height: 40, objectFit: "cover", display: "block" }} />;
  }
  if (colKey === "property_type") {
    return <span style={{ fontFamily: fonts.sans, fontSize: 12 }}>{p.property_type === "house" ? "House" : "Apartment"}</span>;
  }
  if (colKey === "location") {
    return <span style={{ fontFamily: fonts.sans, fontSize: 12, color: C.textMid }}>{p.location || "—"}</span>;
  }
  if (colKey === "price") {
    return (
      <span style={{ fontFamily: fonts.serif, fontSize: 14, fontWeight: 700, color: C.text }}>
        {p.price ? fmt(p.price) : "—"}
      </span>
    );
  }
  if (colKey === "bedrooms") {
    return <span style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600 }}>{p.bedrooms ?? "—"}</span>;
  }
  if (colKey === "bathrooms") {
    return <span style={{ fontFamily: fonts.sans, fontSize: 13 }}>{p.bathrooms ?? "—"}</span>;
  }
  if (colKey === "size") {
    if (!p.size) return <span style={{ color: C.textFaint, fontSize: 12 }}>—</span>;
    return (
      <span style={{ fontFamily: fonts.sans, fontSize: 12 }}>
        {Number(p.size).toLocaleString("en-GB")} {p.size_unit || "sqft"}
      </span>
    );
  }
  if (colKey === "website_link") {
    if (!p.website_link) return <span style={{ color: C.textFaint, fontSize: 12 }}>—</span>;
    let domain = "";
    try { domain = new URL(p.website_link).hostname; } catch {}
    return (
      <a href={p.website_link} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} width={14} height={14} alt="" style={{ display: "block" }} />
        <span style={{ fontSize: 11, color: C.accent, fontFamily: fonts.sans }}>View</span>
      </a>
    );
  }
  if (colKey === "notes") {
    return (
      <span style={{
        fontFamily: fonts.serif, fontSize: 12, color: C.textMid, fontStyle: "italic",
        maxWidth: 200, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {p.notes || "—"}
      </span>
    );
  }
  if (colKey === "created_at") {
    return (
      <span style={{ fontFamily: fonts.sans, fontSize: 11, color: C.textFaint }}>
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
      <span style={{ fontSize: 15, color: checked ? C.green : C.textFaint, fontWeight: 600 }}>
        {checked ? "✓" : "✗"}
      </span>
    );
  }
  if (field.field_type === "ranking") {
    const v = val || 0;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 90 }}>
        <div style={{ flex: 1, height: 4, background: C.border, position: "relative", maxWidth: 60 }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${v * 10}%`, background: C.accent }} />
        </div>
        <span style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: 600, minWidth: 18, color: v > 0 ? C.text : C.textFaint }}>
          {v > 0 ? v : "—"}
        </span>
      </div>
    );
  }
  if (field.field_type === "number") {
    return (
      <span style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600 }}>
        {val !== undefined && val !== "" && val !== null ? Number(val).toLocaleString("en-GB") : "—"}
      </span>
    );
  }
  // text
  return (
    <span style={{
      fontFamily: fonts.sans, fontSize: 12, color: C.textMid,
      maxWidth: 140, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    }}>
      {val || "—"}
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
      if (f.field_type === "number"  && filters[`num_${f.id}`])  list = list.filter(p => (p.custom_values?.[f.id]  || 0) >= Number(filters[`num_${f.id}`]));
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
      if (fieldType !== "ranking" && fieldType !== "number") return;
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
    if (cfField) return cfField.field_type === "ranking" || cfField.field_type === "number";
    return !!COL_SORT_KEYS[colKey];
  };

  // Styles
  const thBase = {
    padding: "10px 14px",
    fontFamily: fonts.sans, fontSize: 9, fontWeight: 700,
    letterSpacing: "0.12em", textTransform: "uppercase", color: C.textLight,
    background: C.bg, borderBottom: `1.5px solid ${C.border}`,
    whiteSpace: "nowrap", textAlign: "left",
    position: "sticky", top: 0, zIndex: 2,
  };
  const tdBase = {
    padding: "11px 14px",
    borderBottom: `1px solid ${C.borderLight}`,
    verticalAlign: "middle",
  };
  const nameThStyle = { ...thBase, position: "sticky", top: 0, left: 0, zIndex: 3, minWidth: 160, borderRight: `1.5px solid ${C.border}` };
  const nameTdBase  = { ...tdBase, position: "sticky", left: 0, zIndex: 1, minWidth: 160, borderRight: `1.5px solid ${C.border}` };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <h2 style={{ fontFamily: fonts.serif, fontWeight: 400, color: C.text, marginBottom: 12 }}>Property Comparison</h2>
        <p style={{ fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic" }}>Sign in to compare properties.</p>
      </div>
    );
  }

  const hiddenColCount = hiddenCols.size;
  const hiddenPropCount = hiddenProps.size;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: fonts.serif, fontWeight: 400, color: C.text, margin: "0 0 4px 0", fontSize: mobile ? 24 : 32 }}>
            Property Comparison
          </h2>
          <p style={{ fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic", margin: 0 }}>
            Side-by-side matrix of all your tracked properties.
          </p>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          style={{
            padding: "9px 18px", border: `1.5px solid ${C.border}`, background: "transparent",
            color: C.textMid, fontSize: 11, fontWeight: 600, fontFamily: fonts.sans, cursor: "pointer",
            textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          Customise
          {(hiddenColCount > 0 || hiddenPropCount > 0) && (
            <span style={{
              background: C.accent, color: "#fff", fontSize: 9, fontWeight: 700,
              padding: "1px 6px", borderRadius: 8, letterSpacing: 0,
            }}>
              {hiddenColCount + hiddenPropCount}
            </span>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: `1.5px solid ${C.border}` }}>
        {[{ key: "rent", label: "Renting" }, { key: "buy", label: "Buying" }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: "10px 24px", border: "none",
            borderBottom: activeTab === t.key ? `3px solid ${C.accent}` : "3px solid transparent",
            background: "transparent", cursor: "pointer",
            color: activeTab === t.key ? C.text : C.textLight,
            fontSize: 13, fontWeight: activeTab === t.key ? 600 : 400,
            fontFamily: fonts.sans, marginBottom: -1.5,
          }}>{t.label}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: fonts.sans, color: C.textLight, alignSelf: "center", paddingRight: 4 }}>
          {displayed.length} / {tabProperties.length} propert{tabProperties.length === 1 ? "y" : "ies"}
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
        <div style={{ color: C.textLight, fontFamily: fonts.serif }}>Loading…</div>
      )}

      {!loading && tabProperties.length === 0 && (
        <div style={{ padding: "48px 24px", border: `1.5px dashed ${C.border}`, textAlign: "center" }}>
          <p style={{ fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic", margin: 0 }}>
            No {activeTab} properties yet. Add some in Gaff Tracker to compare them here.
          </p>
        </div>
      )}

      {!loading && tabProperties.length > 0 && displayed.length === 0 && (
        <div style={{ padding: "48px 24px", border: `1.5px dashed ${C.border}`, textAlign: "center" }}>
          <p style={{ fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic", margin: 0 }}>
            No properties match the current filters or visibility settings.{" "}
            {hiddenPropCount > 0 && (
              <span>
                <button onClick={() => setShowDialog(true)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontFamily: fonts.serif, fontStyle: "italic", fontSize: "inherit", textDecoration: "underline" }}>
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
        <div style={{ overflowX: "auto", border: `1.5px solid ${C.border}` }}>
          <table style={{ borderCollapse: "collapse", tableLayout: "auto" }}>
            <thead>
              <tr>
                {/* Sticky name header */}
                <th style={nameThStyle}>Property</th>

                {/* Standard columns */}
                {visibleStdCols.map(col => {
                  const sortable = isSortable(col.key, null);
                  const indicator = getSortIndicator(col.key, null);
                  return (
                    <th
                      key={col.key}
                      onClick={sortable ? () => handleColHeaderClick(col.key, null) : undefined}
                      style={{
                        ...thBase,
                        cursor: sortable ? "pointer" : "default",
                        color: indicator ? C.accent : C.textLight,
                        userSelect: "none",
                      }}
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
                      style={{
                        ...thBase,
                        cursor: sortable ? "pointer" : "default",
                        color: indicator ? C.accent : C.textLight,
                        userSelect: "none",
                      }}
                    >
                      {f.name}{indicator}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayed.map((p, i) => {
                const rowBg = i % 2 === 0 ? C.card : "#faf8f4";
                return (
                  <tr key={p.id}>
                    {/* Sticky name cell */}
                    <td style={{ ...nameTdBase, background: rowBg }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {p.photo_url && (
                          <img src={p.photo_url} alt="" style={{ width: 48, height: 36, objectFit: "cover", display: "block", marginBottom: 4 }} />
                        )}
                        <span style={{ fontFamily: fonts.serif, fontSize: 14, color: C.text, lineHeight: 1.2 }}>{p.name}</span>
                        {p.location && (
                          <span style={{ fontFamily: fonts.sans, fontSize: 10, color: C.textLight }}>{p.location}</span>
                        )}
                      </div>
                    </td>

                    {/* Standard column cells */}
                    {visibleStdCols.map(col => (
                      <td key={col.key} style={{ ...tdBase, background: rowBg }}>
                        <StdCell colKey={col.key} property={p} />
                      </td>
                    ))}

                    {/* Custom field cells */}
                    {visibleCfCols.map(f => (
                      <td key={f.id} style={{ ...tdBase, background: rowBg }}>
                        <CfCell field={f} property={p} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 48, borderTop: `2px solid ${C.text}`, paddingTop: 16, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: C.textLight, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>Personal Finance Suite</span>
        <span style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.15em", textTransform: "uppercase" }}>Property Comparison</span>
      </div>

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
    </div>
  );
}
