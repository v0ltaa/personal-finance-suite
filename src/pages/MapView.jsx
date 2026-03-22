import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { useAuth } from "../lib/hooks";
import {
  loadProperties, loadCustomFields,
  saveLandmarks, getLandmarks,
  saveLandmarkCategories, getLandmarkCategories, DEFAULT_LANDMARK_CATEGORIES,
  getWorkplaceAddress,
} from "../lib/supabase";
import { geocodeAddress, getRouteDistance, haversineKm } from "../lib/geo";
import { PropertyDetailModal } from "./GaffTracker";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { Input } from "../components/ui/input";

// ─── Sort / filter helpers ────────────────────────────────────────────────────
function applyFilters(list, filters, customFields, activeTab) {
  let res = list.filter(p => p.listing_type === activeTab);
  if (filters.minBeds) res = res.filter(p => p.bedrooms >= Number(filters.minBeds));
  if (filters.maxBeds) res = res.filter(p => p.bedrooms <= Number(filters.maxBeds));
  if (filters.maxPrice) res = res.filter(p => !p.price || p.price <= Number(filters.maxPrice));
  customFields.forEach(f => {
    if (f.field_type === "number" && filters[`num_${f.id}`])
      res = res.filter(p => (p.custom_values?.[f.id] || 0) >= Number(filters[`num_${f.id}`]));
    if (f.field_type === "ranking" && filters[`rank_${f.id}`])
      res = res.filter(p => (p.custom_values?.[f.id] || 0) >= Number(filters[`rank_${f.id}`]));
  });
  return res;
}

function applySort(list, sortBy) {
  if (sortBy === "none") return list;
  return [...list].sort((a, b) => {
    if (sortBy === "date_asc") return new Date(a.created_at) - new Date(b.created_at);
    if (sortBy === "date_desc") return new Date(b.created_at) - new Date(a.created_at);
    if (sortBy === "price_asc") return (a.price || 0) - (b.price || 0);
    if (sortBy === "price_desc") return (b.price || 0) - (a.price || 0);
    if (sortBy === "beds_asc") return (a.bedrooms || 0) - (b.bedrooms || 0);
    if (sortBy === "beds_desc") return (b.bedrooms || 0) - (a.bedrooms || 0);
    if (sortBy.startsWith("rank_")) {
      const [, fieldId, dir] = sortBy.match(/rank_(.+)_(asc|desc)/);
      const av = a.custom_values?.[fieldId] || 0, bv = b.custom_values?.[fieldId] || 0;
      return dir === "desc" ? bv - av : av - bv;
    }
    return 0;
  });
}

// ─── Pin colour / size by rank ────────────────────────────────────────────────
function rankColor(ratio) {
  return `hsl(${Math.round((1 - ratio) * 120)},80%,42%)`;
}
function rankSize(ratio) {
  return Math.round(46 - ratio * 16);
}

// ─── Property type label for default (no-sort) pins ──────────────────────────
function propertyTypeLabel(type) {
  if (!type) return "·";
  const t = type.toLowerCase();
  if (t.includes("studio")) return "S";
  if (t.includes("flat") || t.includes("apartment")) return "F";
  if (t.includes("house") || t.includes("detach") || t.includes("semi") || t.includes("terrace") || t.includes("bungalow") || t.includes("cottage")) return "H";
  return "·";
}

// ─── SVG marker factories ─────────────────────────────────────────────────────
function propertyMarkerIcon(color, size, rankLabel) {
  const r = size / 2;
  const h = size + 12;
  const fs = Math.max(9, Math.round(size / 2.8));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size + 4}" height="${h + 4}" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35))">
    <circle cx="${r + 2}" cy="${r + 2}" r="${r - 1}" fill="${color}" stroke="white" stroke-width="3"/>
    <text x="${r + 2}" y="${r + 2 + fs * 0.36}" text-anchor="middle" fill="white" font-size="${fs}px" font-weight="800" font-family="Arial,sans-serif">${rankLabel}</text>
    <polygon points="${r - 4},${size} ${r + 8},${size} ${r + 2},${h + 1}" fill="${color}"/>
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [size + 4, h + 4], iconAnchor: [r + 2, h + 2], popupAnchor: [0, -(h + 2)] });
}

function specialMarkerIcon(emoji, bg, size = 38) {
  const r = size / 2;
  const h = size + 12;
  const fs = Math.round(size * 0.44);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size + 4}" height="${h + 4}" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.4))">
    <circle cx="${r + 2}" cy="${r + 2}" r="${r - 1}" fill="${bg}" stroke="white" stroke-width="3"/>
    <text x="${r + 2}" y="${r + 2 + fs * 0.36}" text-anchor="middle" font-size="${fs}px">${emoji}</text>
    <polygon points="${r - 4},${size} ${r + 8},${size} ${r + 2},${h + 1}" fill="${bg}"/>
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [size + 4, h + 4], iconAnchor: [r + 2, h + 2], popupAnchor: [0, -(h + 2)] });
}


// ─── Landmark icons ────────────────────────────────────────────────────────────
const LANDMARK_ICONS = [
  { value: "📍", label: "Pin" },
  { value: "🏢", label: "Office" },
  { value: "🎓", label: "School" },
  { value: "🏥", label: "Hospital" },
  { value: "🛒", label: "Shops" },
  { value: "🌳", label: "Park" },
  { value: "🏋️", label: "Gym" },
  { value: "🍺", label: "Pub" },
  { value: "🚉", label: "Station" },
  { value: "🏠", label: "Friend" },
  { value: "⭐", label: "Favourite" },
];

// ─── Landmarks Manager Modal ──────────────────────────────────────────────────
function LandmarksManagerModal({ landmarks, onSave, categories, onSaveCategories, onClose }) {
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newIcon, setNewIcon] = useState("📍");
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editIcon, setEditIcon] = useState("📍");
  const [editCategory, setEditCategory] = useState("");

  const handleAdd = async () => {
    if (!newName.trim() || !newAddress.trim()) return;
    setSaving(true);
    await onSave([...landmarks, { id: Date.now().toString(), name: newName.trim(), address: newAddress.trim(), icon: newIcon, category: newCategory || "" }]);
    setNewName(""); setNewAddress(""); setNewIcon("📍"); setNewCategory("");
    setSaving(false);
  };

  const handleDelete = (id) => onSave(landmarks.filter(l => l.id !== id));

  const handleEdit = (l) => {
    setEditId(l.id); setEditName(l.name); setEditAddress(l.address);
    setEditIcon(l.icon); setEditCategory(l.category || "");
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editAddress.trim()) return;
    setSaving(true);
    await onSave(landmarks.map(l => l.id === editId ? { ...l, name: editName.trim(), address: editAddress.trim(), icon: editIcon, category: editCategory } : l));
    setEditId(null); setSaving(false);
  };

  const handleAddCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    await onSaveCategories([...categories, trimmed]);
    setNewCatName(""); setAddingCategory(false);
  };

  const handleDeleteCategory = async (cat) => {
    if (DEFAULT_LANDMARK_CATEGORIES.includes(cat)) return;
    await onSaveCategories(categories.filter(c => c !== cat));
  };

  const grouped = {};
  categories.forEach(c => { grouped[c] = landmarks.filter(l => l.category === c); });
  const uncategorised = landmarks.filter(l => !l.category);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1100] p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Manage Landmarks</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Add places you care about — they'll appear on the map and in distance calculations.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl bg-transparent border-none cursor-pointer">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-5 scrollbar-thin">
          {/* Categories */}
          <div className="mb-5">
            <div className="text-[9px] tracking-[0.15em] uppercase font-bold text-muted-foreground/70 mb-2">Categories</div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {categories.map(cat => (
                <span key={cat} className="inline-flex items-center gap-1 px-2.5 py-1 border border-border rounded-lg text-xs text-foreground bg-background">
                  {cat}
                  {!DEFAULT_LANDMARK_CATEGORIES.includes(cat) && (
                    <button onClick={() => handleDeleteCategory(cat)} className="border-none bg-transparent text-red-500 cursor-pointer text-sm leading-none pl-0.5">×</button>
                  )}
                </span>
              ))}
              {addingCategory ? (
                <span className="inline-flex items-center gap-1">
                  <Input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Category name" className="w-28 text-xs h-7" onKeyDown={e => { if (e.key === "Enter") handleAddCategory(); if (e.key === "Escape") setAddingCategory(false); }} autoFocus />
                  <Button variant="default" size="sm" onClick={handleAddCategory} disabled={!newCatName.trim()} className="h-7 text-[10px] px-2">Add</Button>
                  <Button variant="outline" size="sm" onClick={() => setAddingCategory(false)} className="h-7 text-[10px] px-2">×</Button>
                </span>
              ) : (
                <button onClick={() => setAddingCategory(true)} className="text-[10px] text-muted-foreground/60 border border-dashed border-border rounded-lg px-2.5 py-1 bg-transparent cursor-pointer hover:border-foreground/30 transition-colors">+ Category</button>
              )}
            </div>
          </div>

          {/* Landmarks by category */}
          {categories.map(cat => {
            const items = grouped[cat] || [];
            if (items.length === 0) return null;
            return (
              <div key={cat} className="mb-4">
                <div className="text-[9px] tracking-[0.12em] uppercase font-bold text-brand mb-1.5">{cat} ({items.length})</div>
                {items.map(l => (
                  <LandmarkRow key={l.id} l={l} editId={editId} editName={editName} editAddress={editAddress} editIcon={editIcon} editCategory={editCategory}
                    setEditName={setEditName} setEditAddress={setEditAddress} setEditIcon={setEditIcon} setEditCategory={setEditCategory}
                    categories={categories} onEdit={handleEdit} onSaveEdit={handleSaveEdit} onCancelEdit={() => setEditId(null)} onDelete={handleDelete} saving={saving} />
                ))}
              </div>
            );
          })}
          {uncategorised.length > 0 && (
            <div className="mb-4">
              <div className="text-[9px] tracking-[0.12em] uppercase font-bold text-muted-foreground/60 mb-1.5">Uncategorised ({uncategorised.length})</div>
              {uncategorised.map(l => (
                <LandmarkRow key={l.id} l={l} editId={editId} editName={editName} editAddress={editAddress} editIcon={editIcon} editCategory={editCategory}
                  setEditName={setEditName} setEditAddress={setEditAddress} setEditIcon={setEditIcon} setEditCategory={setEditCategory}
                  categories={categories} onEdit={handleEdit} onSaveEdit={handleSaveEdit} onCancelEdit={() => setEditId(null)} onDelete={handleDelete} saving={saving} />
              ))}
            </div>
          )}
          {landmarks.length === 0 && (
            <p className="text-sm text-muted-foreground/60 italic text-center py-6">No landmarks yet. Add one below.</p>
          )}

          {/* Add new */}
          <div className="border-t border-border pt-5 mt-3">
            <div className="text-[9px] tracking-[0.12em] uppercase font-bold text-muted-foreground/70 mb-3">Add Landmark</div>
            <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] gap-2.5 items-end">
              <Select value={newIcon} onChange={e => setNewIcon(e.target.value)} className="w-[70px] text-sm h-9">
                {LANDMARK_ICONS.map(ic => <option key={ic.value} value={ic.value}>{ic.value} {ic.label}</option>)}
              </Select>
              <Input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name (e.g. Gym West)" className="text-sm h-9" />
              <Select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-[140px] text-sm h-9">
                <option value="">No category</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </Select>
              <Input type="text" value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Address or postcode" className="text-sm h-9" onKeyDown={e => e.key === "Enter" && handleAdd()} />
              <Button variant="default" size="sm" onClick={handleAdd} disabled={saving || !newName.trim() || !newAddress.trim()} className="h-9 px-5">
                {saving ? "…" : "Add"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LandmarkRow({ l, editId, editName, editAddress, editIcon, editCategory, setEditName, setEditAddress, setEditIcon, setEditCategory, categories, onEdit, onSaveEdit, onCancelEdit, onDelete, saving }) {
  if (editId === l.id) {
    return (
      <div className="flex gap-2 flex-wrap items-center py-1.5 px-2 bg-muted/50 rounded mb-1">
        <Select value={editIcon} onChange={e => setEditIcon(e.target.value)} className="w-14 text-xs h-7">
          {LANDMARK_ICONS.map(ic => <option key={ic.value} value={ic.value}>{ic.value}</option>)}
        </Select>
        <Input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-32 text-xs h-7" />
        <Select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="w-28 text-xs h-7">
          <option value="">No category</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </Select>
        <Input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)} className="flex-1 min-w-[140px] text-xs h-7" onKeyDown={e => e.key === "Enter" && onSaveEdit()} />
        <Button variant="default" size="sm" onClick={onSaveEdit} disabled={saving} className="h-7 text-[10px] px-2">Save</Button>
        <Button variant="outline" size="sm" onClick={onCancelEdit} className="h-7 text-[10px] px-2">×</Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-muted/30 rounded-lg group mb-0.5">
      <span className="text-base">{l.icon}</span>
      <span className="text-sm font-semibold text-foreground">{l.name}</span>
      <span className="text-xs text-muted-foreground/50 truncate flex-1">{l.address}</span>
      <span className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => onEdit(l)} className="text-xs text-brand bg-transparent border-none cursor-pointer font-semibold hover:underline">Edit</button>
        <button onClick={() => onDelete(l.id)} className="text-xs text-red-500 bg-transparent border-none cursor-pointer font-semibold hover:underline">Delete</button>
      </span>
    </div>
  );
}

// ─── Map Controls Overlay ─────────────────────────────────────────────────────
function MapControls({ customFields, sortBy, onSort, filters, onFilter, activeTab, onActiveTab, total, geocoding, categories, visibleCategories, onToggleCategory, onManageLandmarks }) {
  const rankingFields = customFields.filter(f => f.field_type === "ranking");
  const numberFields = customFields.filter(f => f.field_type === "number" || f.field_type === "cost");
  const sortOptions = [
    { value: "none", label: "None" },
    { value: "date_desc", label: "Newest first" },
    { value: "date_asc", label: "Oldest first" },
    { value: "price_asc", label: "Price ↑" },
    { value: "price_desc", label: "Price ↓" },
    { value: "beds_asc", label: "Beds ↑" },
    { value: "beds_desc", label: "Beds ↓" },
    ...rankingFields.map(f => ({ value: `rank_${f.id}_desc`, label: `${f.name} ↓` })),
    ...rankingFields.map(f => ({ value: `rank_${f.id}_asc`, label: `${f.name} ↑` })),
  ];
  const hasFilters = Object.values(filters).some(v => v !== "" && v !== undefined);

  return (
    <div className="absolute top-3 left-3 z-[1000] w-60">
      <div className="bg-card/95 backdrop-blur border border-border rounded-xl shadow-xl overflow-hidden">

        {/* ── Rent / Buy underline tabs ── */}
        <div className="flex border-b border-border/60 px-1">
          {[{ key: "rent", label: "Rent" }, { key: "buy", label: "Buy" }].map(t => (
            <button
              key={t.key}
              onClick={() => onActiveTab(t.key)}
              className={cn(
                "px-4 py-2.5 text-[11px] font-semibold cursor-pointer bg-transparent border-none transition-all duration-150 border-b-2 -mb-px",
                activeTab === t.key
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground/50 ml-auto self-center pr-3">
            {geocoding ? "…" : total}
          </span>
        </div>

        {/* ── Filters — always visible ── */}
        <div className="p-3.5 max-h-[calc(100vh-220px)] overflow-y-auto">
          <div className="mb-3.5">
            <div className="text-[8px] tracking-[0.18em] uppercase font-bold text-brand mb-1.5">
              Sort — affects pin size &amp; colour
            </div>
            <Select value={sortBy} onChange={e => onSort(e.target.value)} className="w-full text-[11px] h-8">
              {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[8px] tracking-[0.18em] uppercase font-bold text-brand">Filters</span>
              {hasFilters && (
                <button onClick={() => onFilter({})} className="text-[9px] bg-none border-none text-brand cursor-pointer font-semibold">
                  Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-2">
              {[["Min beds", "minBeds"], ["Max beds", "maxBeds"], ["Max £", "maxPrice"]].map(([label, key]) => (
                <div key={key}>
                  <div className="text-[8px] text-muted-foreground mb-[3px] uppercase tracking-[0.08em]">{label}</div>
                  <Input type="number" min={0} value={filters[key] || ""} onChange={e => onFilter({ ...filters, [key]: e.target.value })} className="w-16 h-7 text-[11px]" />
                </div>
              ))}
              {rankingFields.map(f => (
                <div key={f.id}>
                  <div className="text-[8px] text-muted-foreground mb-[3px] uppercase tracking-[0.08em]">Min {f.name}</div>
                  <Input type="number" min={1} max={10} value={filters[`rank_${f.id}`] || ""} onChange={e => onFilter({ ...filters, [`rank_${f.id}`]: e.target.value })} className="w-16 h-7 text-[11px]" />
                </div>
              ))}
              {numberFields.map(f => (
                <div key={f.id}>
                  <div className="text-[8px] text-muted-foreground mb-[3px] uppercase tracking-[0.08em]">Min {f.name}</div>
                  <Input type="number" min={0} value={filters[`num_${f.id}`] || ""} onChange={e => onFilter({ ...filters, [`num_${f.id}`]: e.target.value })} className="w-16 h-7 text-[11px]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Colour legend — only when a sort is active */}
      {sortBy !== "none" && (
        <div className="mt-2 bg-card/95 backdrop-blur border border-border rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-md">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-[hsl(120,78%,40%)] border-2 border-white shadow-sm" />
            <span className="text-[9px] text-muted-foreground">Best</span>
          </div>
          <div className="flex-1 h-[5px] rounded-full" style={{ background: "linear-gradient(to right, hsl(120,78%,40%), hsl(60,78%,42%), hsl(0,78%,40%))" }} />
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[hsl(0,78%,40%)] border-2 border-white shadow-sm" />
            <span className="text-[9px] text-muted-foreground">Worst</span>
          </div>
        </div>
      )}

      <div className="mt-1.5 bg-card/95 backdrop-blur border border-border rounded-xl px-2.5 py-1.5 shadow-md">
        <div className="flex gap-3 flex-wrap items-center">
          <span className="text-[9px] text-muted-foreground flex items-center gap-1">🏢 Workplace</span>
          <span className="text-[9px] text-muted-foreground flex items-center gap-1">📍 Landmark</span>
        </div>
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center mt-1.5 pt-1.5 border-t border-border/50">
            <span className="text-[8px] tracking-[0.12em] uppercase font-bold text-muted-foreground/60 mr-0.5">Show:</span>
            {categories.map(cat => (
              <label key={cat} className="flex items-center gap-1 cursor-pointer select-none">
                <input type="checkbox" checked={visibleCategories[cat] !== false} onChange={() => onToggleCategory(cat)} className="w-3 h-3 accent-brand rounded cursor-pointer" />
                <span className="text-[9px] text-muted-foreground">{cat}</span>
              </label>
            ))}
          </div>
        )}
        <button
          onClick={onManageLandmarks}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-[10px] font-semibold text-brand bg-brand/10 border border-brand/20 rounded-lg cursor-pointer hover:bg-brand/20 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L12 22"/><path d="M2 12L22 12"/></svg>
          Manage Landmarks
        </button>
      </div>
    </div>
  );
}

// ─── Distance Matrix Modal ────────────────────────────────────────────────────
export function DistanceMatrixModal({ properties, initialProperty, landmarks, workplaceAddress, onClose }) {
  const [selectedIds, setSelectedIds] = useState(initialProperty ? [initialProperty.id] : []);
  const [results, setResults] = useState({}); // { `${propId}_${landmarkId}_${mode}`: "12 min" }
  const [calculating, setCalculating] = useState(false);
  const [mode, setMode] = useState("car"); // car | foot | bike

  // All target locations: workplace + landmarks
  const targets = useMemo(() => {
    const t = [];
    if (workplaceAddress) t.push({ id: "__workplace", name: "🏢 Workplace", address: workplaceAddress, category: "" });
    landmarks.forEach(l => t.push({ id: l.id, name: `${l.icon} ${l.name}`, address: l.address, category: l.category || "" }));
    return t;
  }, [landmarks, workplaceAddress]);

  const selectedProps = properties.filter(p => selectedIds.includes(p.id));

  // Calculate distances
  const calculate = useCallback(async () => {
    if (selectedProps.length === 0 || targets.length === 0) return;
    setCalculating(true);
    const newResults = { ...results };

    for (const prop of selectedProps) {
      const propCoord = await geocodeAddress(prop.location);
      if (!propCoord) continue;

      for (const target of targets) {
        const key = `${prop.id}_${target.id}_${mode}`;
        if (newResults[key]) continue; // already calculated

        const targetCoord = await geocodeAddress(target.address);
        if (!targetCoord) { newResults[key] = "—"; continue; }

        const route = await getRouteDistance(propCoord, targetCoord, mode);
        if (route) {
          newResults[key] = `${route.duration} (${route.distance})`;
        } else {
          // fallback to haversine
          const km = haversineKm(propCoord, targetCoord);
          newResults[key] = `~${km.toFixed(1)} km (straight)`;
        }
        setResults({ ...newResults });
      }
    }
    setResults(newResults);
    setCalculating(false);
  }, [selectedProps, targets, mode, results]);

  useEffect(() => { calculate(); }, [selectedIds, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleProp = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1100] p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Distance Matrix</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Travel times from properties to all landmarks</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl bg-transparent border-none cursor-pointer">×</button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4 scrollbar-thin">
          {/* Property selector */}
          <div className="mb-4">
            <div className="text-[9px] tracking-[0.12em] uppercase font-bold text-muted-foreground/70 mb-1.5">Properties</div>
            <div className="flex gap-1.5 flex-wrap">
              {properties.filter(p => p.location).map(p => (
                <button
                  key={p.id}
                  onClick={() => toggleProp(p.id)}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-medium border rounded-lg cursor-pointer transition-colors",
                    selectedIds.includes(p.id)
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-transparent text-muted-foreground hover:bg-muted"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Mode selector */}
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[9px] tracking-[0.12em] uppercase font-bold text-muted-foreground/70">Mode:</span>
            {[{ key: "car", label: "🚗 Drive" }, { key: "foot", label: "🚶 Walk" }, { key: "bike", label: "🚴 Cycle" }].map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={cn(
                  "px-3 py-1 text-[11px] font-medium border rounded cursor-pointer transition-colors",
                  mode === m.key
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-transparent text-muted-foreground hover:bg-muted"
                )}
              >
                {m.label}
              </button>
            ))}
            {calculating && <span className="text-[10px] text-muted-foreground/60 ml-2 animate-pulse">Calculating…</span>}
          </div>

          {/* Matrix table */}
          {selectedProps.length > 0 && targets.length > 0 && (
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2.5 text-[9px] tracking-[0.1em] uppercase font-bold text-muted-foreground border-b border-border sticky left-0 bg-muted/50 z-10">
                      Property
                    </th>
                    {targets.map(t => (
                      <th key={t.id} className="text-center px-3 py-2.5 text-[9px] tracking-[0.06em] uppercase font-bold text-muted-foreground border-b border-border min-w-[120px]">
                        <div>{t.name}</div>
                        {t.category && <div className="text-[8px] text-muted-foreground/50 font-normal normal-case">{t.category}</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedProps.map((prop, i) => (
                    <tr key={prop.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <td className="px-3 py-2 font-medium text-foreground border-b border-border/50 sticky left-0 bg-card z-10 whitespace-nowrap">
                        {prop.name}
                        <div className="text-[10px] text-muted-foreground/60 font-normal">{prop.location}</div>
                      </td>
                      {targets.map(t => {
                        const key = `${prop.id}_${t.id}_${mode}`;
                        const val = results[key];
                        return (
                          <td key={t.id} className="text-center px-3 py-2 border-b border-border/50 text-muted-foreground">
                            {val || <span className="text-muted-foreground/30">…</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedProps.length === 0 && (
            <p className="text-sm text-muted-foreground/60 italic text-center py-8">Select one or more properties above to see distances.</p>
          )}
          {targets.length === 0 && (
            <p className="text-sm text-muted-foreground/60 italic text-center py-8">Add landmarks or set a workplace address to see distances.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Property Hover Card ──────────────────────────────────────────────────────
function PropertyHoverCard({ prop, x, y }) {
  const hasPhoto = !!prop.photo_url;
  const price = prop.price ? `£${Number(prop.price).toLocaleString()}` : null;
  const priceSuffix = prop.listing_type === "rent" ? " pcm" : null;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -100%)",
        zIndex: 1050,
        width: 264,
        pointerEvents: "none",
      }}
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in">
      {hasPhoto && (
        <div className="h-36 overflow-hidden bg-muted">
          <img src={prop.photo_url} alt={prop.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className={cn("px-3.5", hasPhoto ? "py-3" : "py-3.5")}>
        {price && (
          <div className="font-serif text-xl font-bold text-foreground leading-none">
            {price}
            {priceSuffix && (
              <span className="text-xs font-sans font-normal text-muted-foreground ml-1">{priceSuffix}</span>
            )}
          </div>
        )}
        <div className={cn("text-sm font-medium text-foreground truncate leading-snug", price ? "mt-2" : "")}>
          {prop.name}
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
          {prop.property_type && (
            <span className="capitalize">{prop.property_type}</span>
          )}
          {prop.bedrooms != null && prop.bedrooms !== "" && (
            <span className="flex items-center gap-1">🛏 {prop.bedrooms}</span>
          )}
          {prop.bathrooms != null && prop.bathrooms !== "" && (
            <span className="flex items-center gap-1">🚿 {prop.bathrooms}</span>
          )}
        </div>
        {prop.location && (
          <div className="text-[10px] text-muted-foreground/60 mt-1.5 truncate">{prop.location}</div>
        )}
        <div className="mt-2 pt-2 border-t border-border/50 text-[9px] tracking-[0.1em] uppercase text-muted-foreground/40 font-medium">
          Click pin to view details
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Landmark Hover Card ──────────────────────────────────────────────────────
function LandmarkHoverCard({ landmark, x, y }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -100%)",
        zIndex: 1050,
        width: 200,
        pointerEvents: "none",
      }}
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="px-3.5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">{landmark.icon}</span>
            <span className="text-sm font-semibold text-foreground leading-snug">{landmark.name}</span>
          </div>
          {landmark.category && (
            <div className="text-[10px] text-brand font-semibold uppercase tracking-[0.1em] mt-1.5">{landmark.category}</div>
          )}
          {landmark.address && (
            <div className="text-[10px] text-muted-foreground/70 mt-1 truncate">{landmark.address}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main MapView ─────────────────────────────────────────────────────────────
export default function MapView() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [properties, setProperties] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [landmarks, setLandmarks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);

  const [propCoords, setPropCoords] = useState({});
  const [workplaceCoord, setWorkplaceCoord] = useState(null);
  const [landmarkCoords, setLandmarkCoords] = useState({});

  const [activeTab, setActiveTab] = useState("rent");
  const [sortBy, setSortBy] = useState("none");
  const [filters, setFilters] = useState({});
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [hoverCard, setHoverCard] = useState(null);
  const [visibleCategories, setVisibleCategories] = useState({});
  const [showLandmarksModal, setShowLandmarksModal] = useState(false);

  const workplaceAddress = getWorkplaceAddress(user);

  // Leaflet imperatives
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const hasFitRef = useRef(false);

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLandmarks(getLandmarks(user));
    const cats = getLandmarkCategories(user);
    setCategories(cats);
    // Default all categories visible
    setVisibleCategories(prev => {
      const next = { ...prev };
      cats.forEach(c => { if (next[c] === undefined) next[c] = true; });
      return next;
    });
    Promise.all([loadProperties(), loadCustomFields()]).then(([pRes, cfRes]) => {
      const props = pRes.data || [];
      setProperties(props);
      setCustomFields(cfRes.data || []);
      const stored = {};
      props.forEach(p => {
        if (p.custom_values?.__lat != null && p.custom_values?.__lng != null) {
          stored[p.id] = { lat: p.custom_values.__lat, lng: p.custom_values.__lng };
        }
      });
      if (Object.keys(stored).length > 0) setPropCoords(stored);
      setLoading(false);
    });
  }, [user]);

  // ── Filtered + sorted list ───────────────────────────────────────────────────
  const displayed = useMemo(
    () => applySort(applyFilters(properties, filters, customFields, activeTab), sortBy),
    [properties, filters, customFields, activeTab, sortBy],
  );

  // ── Geocode missing property addresses ───────────────────────────────────────
  useEffect(() => {
    const missing = displayed.filter(p => p.location && !propCoords[p.id]);
    if (!missing.length) return;
    let cancelled = false;
    setGeocoding(true);
    (async () => {
      const results = [];
      for (const p of missing) {
        if (cancelled) break;
        const coord = await geocodeAddress(p.location);
        results.push({ id: p.id, coord });
      }
      if (!cancelled) {
        setPropCoords(prev => {
          const next = { ...prev };
          results.forEach(({ id, coord }) => { if (coord) next[id] = coord; });
          return next;
        });
        setGeocoding(false);
      }
    })();
    return () => { cancelled = true; };
  }, [displayed]);

  // ── Geocode workplace ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!workplaceAddress) return;
    geocodeAddress(workplaceAddress).then(setWorkplaceCoord);
  }, [workplaceAddress]);

  // ── Geocode landmarks ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      for (const l of landmarks) {
        if (!landmarkCoords[l.id] && l.address) {
          const coord = await geocodeAddress(l.address);
          if (coord) setLandmarkCoords(prev => ({ ...prev, [l.id]: coord }));
        }
      }
    })();
  }, [landmarks]);

  // ── Initialise Leaflet map ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [53.5, -2.2], zoom: 6, zoomControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      hasFitRef.current = false;
    };
  }, [user]);

  // ── Update markers imperatively ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    setHoverCard(null);

    const total = displayed.length;
    const coordsToFit = [];

    // Property markers
    const ranked = sortBy !== "none";
    displayed.forEach((prop, idx) => {
      const coord = propCoords[prop.id];
      if (!coord) return;
      const ratio = ranked && total > 1 ? idx / (total - 1) : 0.5;
      const color = ranked ? rankColor(ratio) : "hsl(18,60%,38%)";
      const size = ranked ? rankSize(ratio) : 36;
      const label = ranked ? String(idx + 1) : propertyTypeLabel(prop.property_type);
      const r = size / 2;
      const h = size + 12;
      const marker = L.marker([coord.lat, coord.lng], {
        icon: propertyMarkerIcon(color, size, label),
        zIndexOffset: ranked ? (total - idx + 10) : 10,
      })
        .on("mouseover", () => {
          const svg = marker._icon?.querySelector("svg");
          if (svg) {
            svg.style.transition = "transform 0.18s ease, filter 0.18s ease";
            svg.style.transformOrigin = `${r + 2}px ${h + 2}px`;
            svg.style.transform = "scale(1.25)";
            svg.style.filter = "brightness(1.25) saturate(1.3) drop-shadow(0 4px 10px rgba(0,0,0,0.45))";
          }
          const point = map.latLngToContainerPoint([coord.lat, coord.lng]);
          const scaledPinTop = Math.round((h + 4) * 1.25);
          setHoverCard({ type: "property", prop, x: point.x, y: point.y - scaledPinTop - 8 });
        })
        .on("mouseout", () => {
          const svg = marker._icon?.querySelector("svg");
          if (svg) {
            svg.style.transform = "";
            svg.style.filter = "";
          }
          setHoverCard(null);
        })
        .on("click", () => setSelectedProperty(prop))
        .addTo(map);
      markersRef.current.push(marker);
      coordsToFit.push([coord.lat, coord.lng]);
    });

    // Workplace marker
    if (workplaceCoord) {
      const wSize = 40, wR = 20, wH = 52;
      const marker = L.marker([workplaceCoord.lat, workplaceCoord.lng], {
        icon: specialMarkerIcon("🏢", "#b8860b", wSize),
        zIndexOffset: 9999,
      })
        .on("mouseover", () => {
          const svg = marker._icon?.querySelector("svg");
          if (svg) {
            svg.style.transition = "transform 0.18s ease, filter 0.18s ease";
            svg.style.transformOrigin = `${wR + 2}px ${wH + 2}px`;
            svg.style.transform = "scale(1.2)";
            svg.style.filter = "brightness(1.3) saturate(1.2) drop-shadow(0 3px 8px rgba(0,0,0,0.4))";
          }
          const point = map.latLngToContainerPoint([workplaceCoord.lat, workplaceCoord.lng]);
          const scaledPinTop = Math.round((wH + 4) * 1.2);
          setHoverCard({ type: "landmark", landmark: { icon: "🏢", name: "Workplace", address: workplaceAddress || "", category: "" }, x: point.x, y: point.y - scaledPinTop - 8 });
        })
        .on("mouseout", () => {
          const svg = marker._icon?.querySelector("svg");
          if (svg) { svg.style.transform = ""; svg.style.filter = ""; }
          setHoverCard(null);
        })
        .addTo(map);
      markersRef.current.push(marker);
      coordsToFit.push([workplaceCoord.lat, workplaceCoord.lng]);
    }

    // Landmark markers (respect category visibility)
    landmarks.forEach(l => {
      if (l.category && !visibleCategories[l.category]) return;
      const coord = landmarkCoords[l.id];
      if (!coord) return;
      const lSize = 36, lR = 18, lH = 48;
      const marker = L.marker([coord.lat, coord.lng], {
        icon: specialMarkerIcon(l.icon, "#555", lSize),
        zIndexOffset: 9998,
      })
        .on("mouseover", () => {
          const svg = marker._icon?.querySelector("svg");
          if (svg) {
            svg.style.transition = "transform 0.18s ease, filter 0.18s ease";
            svg.style.transformOrigin = `${lR + 2}px ${lH + 2}px`;
            svg.style.transform = "scale(1.2)";
            svg.style.filter = "brightness(1.3) saturate(1.2) drop-shadow(0 3px 8px rgba(0,0,0,0.4))";
          }
          const point = map.latLngToContainerPoint([coord.lat, coord.lng]);
          const scaledPinTop = Math.round((lH + 4) * 1.2);
          setHoverCard({ type: "landmark", landmark: l, x: point.x, y: point.y - scaledPinTop - 8 });
        })
        .on("mouseout", () => {
          const svg = marker._icon?.querySelector("svg");
          if (svg) {
            svg.style.transform = "";
            svg.style.filter = "";
          }
          setHoverCard(null);
        })
        .addTo(map);
      markersRef.current.push(marker);
      coordsToFit.push([coord.lat, coord.lng]);
    });

    // Fit bounds on first meaningful data load
    if (coordsToFit.length > 0 && !hasFitRef.current) {
      const bounds = L.latLngBounds(coordsToFit);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { paddingTopLeft: [270, 60], paddingBottomRight: [40, 40] });
        hasFitRef.current = true;
      }
    }
  }, [displayed, propCoords, workplaceCoord, workplaceAddress, landmarks, landmarkCoords, visibleCategories, sortBy]);

  // ── Save landmarks ────────────────────────────────────────────────────────────
  const handleSaveLandmarks = async (updated) => {
    await saveLandmarks(updated);
    setLandmarks(updated);
    for (const l of updated) {
      if (!landmarkCoords[l.id] && l.address) {
        const coord = await geocodeAddress(l.address);
        if (coord) setLandmarkCoords(prev => ({ ...prev, [l.id]: coord }));
      }
    }
  };

  const handleSaveCategories = async (updated) => {
    await saveLandmarkCategories(updated);
    setCategories(updated);
  };

  // ── Not signed in ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="text-center px-5 py-20">
        <h2 className="text-2xl font-normal text-foreground mb-3">Map View</h2>
        <p className="text-muted-foreground italic">Sign in to view your saved properties on a map.</p>
      </div>
    );
  }

  const total = displayed.length;

  return (
    <div className="flex flex-col h-[calc(100vh-117px)]">
      <div className="flex-1 relative overflow-hidden">
        {/* Leaflet map container — vanilla, no react-leaflet */}
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

        {/* Controls overlay */}
        <MapControls
          customFields={customFields}
          sortBy={sortBy}
          onSort={setSortBy}
          filters={filters}
          onFilter={setFilters}
          activeTab={activeTab}
          onActiveTab={setActiveTab}
          total={total}
          geocoding={geocoding}
          categories={categories}
          visibleCategories={visibleCategories}
          onToggleCategory={(cat) => setVisibleCategories(prev => ({ ...prev, [cat]: prev[cat] === false ? true : false }))}
          onManageLandmarks={() => setShowLandmarksModal(true)}
        />

        {hoverCard?.type === "property" && (
          <PropertyHoverCard prop={hoverCard.prop} x={hoverCard.x} y={hoverCard.y} />
        )}
        {hoverCard?.type === "landmark" && (
          <LandmarkHoverCard landmark={hoverCard.landmark} x={hoverCard.x} y={hoverCard.y} />
        )}

        {(loading || geocoding) && (
          <div className="absolute bottom-4 right-4 bg-card border border-border rounded-lg px-3.5 py-1.5 text-[11px] text-muted-foreground shadow-md z-[1000]">
            {loading ? "Loading properties…" : "Placing pins…"}
          </div>
        )}

        {!loading && displayed.length === 0 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl px-8 py-6 text-center shadow-xl z-[1000]">
            <p className="text-muted-foreground italic m-0">
              {properties.filter(p => p.listing_type === activeTab).length === 0
                ? `No ${activeTab} properties saved yet. Add some in Gaff Tracker.`
                : "No properties match the current filters."}
            </p>
          </div>
        )}
      </div>

      {selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          customFields={customFields}
          workplaceAddress={workplaceAddress}
          landmarks={landmarks}
          costPerMile={null}
          onEdit={() => { setSelectedProperty(null); navigate("/gaff", { state: { editPropertyId: selectedProperty.id } }); }}
          onClose={() => setSelectedProperty(null)}
          mobile={false}
          userId={user?.id}
          displayCurrency={null}
          rates={null}
          onMainPhotoChange={() => {}}
          onMarkSold={null}
        />
      )}

      {showLandmarksModal && (
        <LandmarksManagerModal
          landmarks={landmarks}
          onSave={handleSaveLandmarks}
          categories={categories}
          onSaveCategories={handleSaveCategories}
          onClose={() => setShowLandmarksModal(false)}
        />
      )}

    </div>
  );
}
