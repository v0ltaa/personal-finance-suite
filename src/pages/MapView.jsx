import { useState, useEffect, useRef, useMemo } from "react";
import { fmt } from "../lib/tokens";
import { useAuth } from "../lib/hooks";
import {
  loadProperties, loadCustomFields,
  saveLandmarks, getLandmarks,
  getWorkplaceAddress,
} from "../lib/supabase";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { Input } from "../components/ui/input";

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

// ─── Maps SDK loader ───────────────────────────────────────────────────────────
async function loadMapsSDK() {
  if (window.google?.maps?.Map) return;
  return new Promise((resolve, reject) => {
    if (document.querySelector("[data-gmaps]")) {
      const t = setInterval(() => { if (window.google?.maps?.Map) { clearInterval(t); resolve(); } }, 100);
      return;
    }
    const sc = document.createElement("script");
    sc.setAttribute("data-gmaps", "1");
    sc.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}`;
    sc.onload = resolve;
    sc.onerror = reject;
    document.head.appendChild(sc);
  });
}

// ─── Geocoding (cached) ────────────────────────────────────────────────────────
const geocodeCache = {};
function geocodeAddress(address) {
  if (!address?.trim()) return Promise.resolve(null);
  const key = address.trim().toLowerCase();
  if (geocodeCache[key]) return Promise.resolve(geocodeCache[key]);
  return new Promise((resolve) => {
    new window.google.maps.Geocoder().geocode({ address }, (results, status) => {
      if (status === "OK" && results[0]) {
        const loc = { lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() };
        geocodeCache[key] = loc;
        resolve(loc);
      } else {
        resolve(null);
      }
    });
  });
}

// ─── Sort / filter helpers (mirror of GaffTracker logic) ─────────────────────
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

// ─── Pin colour / size by rank ─────────────────────────────────────────────────
// ratio 0 = rank #1 = best = green/large; ratio 1 = last = red/small
function rankColor(ratio) {
  return `hsl(${Math.round((1 - ratio) * 120)},78%,40%)`;
}
function rankSize(ratio) {
  return Math.round(40 - ratio * 16); // 40 → 24 px
}

// ─── SVG marker factories ──────────────────────────────────────────────────────
function propertyMarkerIcon(color, size, rankLabel) {
  const r = size / 2;
  const h = size + 10;
  const fs = Math.max(8, Math.round(size / 3));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}">
    <circle cx="${r}" cy="${r}" r="${r - 2}" fill="${color}" stroke="white" stroke-width="2.5"/>
    <text x="${r}" y="${r + fs * 0.38}" text-anchor="middle" fill="white" font-size="${fs}px" font-weight="700" font-family="Arial,sans-serif">${rankLabel}</text>
    <polygon points="${r - 4},${size - 1} ${r + 4},${size - 1} ${r},${h - 1}" fill="${color}"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(size, h),
    anchor: new window.google.maps.Point(r, h),
  };
}

function specialMarkerIcon(emoji, bg, size = 34) {
  const r = size / 2;
  const h = size + 10;
  const fs = Math.round(size * 0.46);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}">
    <circle cx="${r}" cy="${r}" r="${r - 2}" fill="${bg}" stroke="white" stroke-width="2.5"/>
    <text x="${r}" y="${r + fs * 0.38}" text-anchor="middle" font-size="${fs}px">${emoji}</text>
    <polygon points="${r - 4},${size - 1} ${r + 4},${size - 1} ${r},${h - 1}" fill="${bg}"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(size, h),
    anchor: new window.google.maps.Point(r, h),
  };
}

// ─── Landmark icon options ─────────────────────────────────────────────────────
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
  { value: "⭐", label: "Favourite" },
];

// ─── Landmarks Panel ──────────────────────────────────────────────────────────
function LandmarksPanel({ landmarks, onSave, workplaceAddress }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newIcon, setNewIcon] = useState("📍");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim() || !newAddress.trim()) return;
    setSaving(true);
    await onSave([...landmarks, { id: Date.now().toString(), name: newName.trim(), address: newAddress.trim(), icon: newIcon }]);
    setNewName(""); setNewAddress(""); setNewIcon("📍"); setAdding(false);
    setSaving(false);
  };

  const handleDelete = (id) => onSave(landmarks.filter(l => l.id !== id));

  return (
    <div className="bg-card border-b-[1.5px] border-border shrink-0">
      {/* Collapsed bar */}
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center gap-4 px-5 py-2.5 cursor-pointer select-none min-h-[44px]"
      >
        <span className="text-[9px] tracking-[0.2em] uppercase font-bold text-muted-foreground shrink-0">
          Landmarks
        </span>
        <div className="flex gap-3.5 flex-wrap items-center flex-1 overflow-hidden">
          {workplaceAddress && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 whitespace-nowrap">
              🏢 <span className="max-w-[200px] overflow-hidden text-ellipsis inline-block">{workplaceAddress}</span>
            </span>
          )}
          {landmarks.slice(0, 5).map(l => (
            <span key={l.id} className="text-[11px] text-muted-foreground flex items-center gap-1 whitespace-nowrap">
              {l.icon} {l.name.length > 18 ? l.name.slice(0, 18) + "…" : l.name}
            </span>
          ))}
          {landmarks.length > 5 && (
            <span className="text-[10px] text-muted-foreground/60">+{landmarks.length - 5} more</span>
          )}
          {!workplaceAddress && landmarks.length === 0 && (
            <span className="text-[11px] text-muted-foreground/60 italic">None added yet — click to expand</span>
          )}
        </div>
        <span className={cn("text-muted-foreground/60 text-[13px] shrink-0 transition-transform duration-200", open ? "rotate-0" : "-rotate-90")}>
          ▾
        </span>
      </div>

      {/* Expanded */}
      {open && (
        <div className="px-5 pb-4 pt-1 border-t border-border/50">
          {!workplaceAddress && (
            <p className="text-xs text-muted-foreground italic my-2.5 mb-3">
              Tip: Set your workplace address in Gaff Tracker → Settings to pin it on the map.
            </p>
          )}

          {/* Landmark chips */}
          {landmarks.length > 0 && (
            <div className="flex flex-wrap gap-2 my-2.5 mb-3.5">
              {landmarks.map(l => (
                <div key={l.id} className="flex items-center gap-1.5 px-2.5 py-[5px] border border-border bg-background rounded text-xs">
                  <span>{l.icon}</span>
                  <span className="text-foreground font-semibold">{l.name}</span>
                  <span className="text-muted-foreground/60 text-[10px]">
                    {l.address.length > 28 ? l.address.slice(0, 28) + "…" : l.address}
                  </span>
                  <button
                    onClick={() => handleDelete(l.id)}
                    className="border-none bg-none text-red-500 cursor-pointer text-base pl-1 leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          {adding ? (
            <div className="flex gap-2 flex-wrap items-end">
              <Select
                value={newIcon}
                onChange={e => setNewIcon(e.target.value)}
                className="w-14 text-xs"
              >
                {LANDMARK_ICONS.map(ic => <option key={ic.value} value={ic.value}>{ic.value} {ic.label}</option>)}
              </Select>
              <Input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Name (e.g. Sister's school)"
                className="w-44 text-xs h-8"
              />
              <Input
                type="text"
                value={newAddress}
                onChange={e => setNewAddress(e.target.value)}
                placeholder="Address or postcode"
                className="flex-1 min-w-[200px] text-xs h-8"
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
              <Button
                variant="default"
                size="sm"
                onClick={handleAdd}
                disabled={saving || !newName.trim() || !newAddress.trim()}
                className="uppercase tracking-[0.06em] opacity-100 disabled:opacity-60"
              >
                {saving ? "…" : "Add"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdding(true)}
              className="uppercase tracking-[0.08em] text-[10px]"
            >
              + Add Landmark
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Map Controls Overlay (filter + sort) ────────────────────────────────────
function MapControls({ customFields, sortBy, onSort, filters, onFilter, activeTab, onActiveTab, total, geocoding }) {
  const [open, setOpen] = useState(false);
  const rankingFields = customFields.filter(f => f.field_type === "ranking");
  const numberFields = customFields.filter(f => f.field_type === "number" || f.field_type === "cost");
  const sortOptions = [
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
    <div className="absolute top-3 left-3 z-10 w-60">
      <div className="bg-card/95 backdrop-blur border border-border rounded-xl shadow-xl overflow-hidden">
        {/* Tab bar + toggle */}
        <div className={cn(
          "flex items-center px-2.5 py-2 gap-1.5",
          open ? "border-b border-border/50" : ""
        )}>
          {[{ key: "rent", label: "Rent" }, { key: "buy", label: "Buy" }].map(t => (
            <button
              key={t.key}
              onClick={() => onActiveTab(t.key)}
              className={cn(
                "px-3.5 py-1 text-[11px] font-semibold border-[1.5px] cursor-pointer transition-colors rounded",
                activeTab === t.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              {t.label}
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground/60 ml-auto">
            {geocoding ? "…" : `${total} shown`}
          </span>
          <button
            onClick={() => setOpen(!open)}
            className="px-2 py-[3px] text-[10px] bg-transparent border border-border cursor-pointer text-muted-foreground ml-1 rounded hover:bg-muted transition-colors"
          >
            {hasFilters ? "● " : ""}{open ? "▴" : "▾"}
          </button>
        </div>

        {/* Expanded controls */}
        {open && (
          <div className="p-3.5 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Sort */}
            <div className="mb-3.5">
              <div className="text-[8px] tracking-[0.18em] uppercase font-bold text-brand mb-1.5">
                Sort — affects pin size &amp; colour
              </div>
              <Select value={sortBy} onChange={e => onSort(e.target.value)} className="w-full text-[11px] h-8">
                {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>

            {/* Filters */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[8px] tracking-[0.18em] uppercase font-bold text-brand">Filters</span>
                {hasFilters && (
                  <button
                    onClick={() => onFilter({})}
                    className="text-[9px] bg-none border-none text-brand cursor-pointer font-semibold"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-2">
                {[["Min beds", "minBeds"], ["Max beds", "maxBeds"], ["Max £", "maxPrice"]].map(([label, key]) => (
                  <div key={key}>
                    <div className="text-[8px] text-muted-foreground mb-[3px] uppercase tracking-[0.08em]">{label}</div>
                    <Input
                      type="number"
                      min={0}
                      value={filters[key] || ""}
                      onChange={e => onFilter({ ...filters, [key]: e.target.value })}
                      className="w-16 h-7 text-[11px]"
                    />
                  </div>
                ))}
                {rankingFields.map(f => (
                  <div key={f.id}>
                    <div className="text-[8px] text-muted-foreground mb-[3px] uppercase tracking-[0.08em]">Min {f.name}</div>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={filters[`rank_${f.id}`] || ""}
                      onChange={e => onFilter({ ...filters, [`rank_${f.id}`]: e.target.value })}
                      className="w-16 h-7 text-[11px]"
                    />
                  </div>
                ))}
                {numberFields.map(f => (
                  <div key={f.id}>
                    <div className="text-[8px] text-muted-foreground mb-[3px] uppercase tracking-[0.08em]">Min {f.name}</div>
                    <Input
                      type="number"
                      min={0}
                      value={filters[`num_${f.id}`] || ""}
                      onChange={e => onFilter({ ...filters, [`num_${f.id}`]: e.target.value })}
                      className="w-16 h-7 text-[11px]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rank legend */}
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

      {/* Key for special markers */}
      <div className="mt-1.5 bg-card/95 backdrop-blur border border-border rounded-xl px-2.5 py-1.5 flex gap-3 shadow-md">
        <span className="text-[9px] text-muted-foreground flex items-center gap-1">🏢 Workplace</span>
        <span className="text-[9px] text-muted-foreground flex items-center gap-1">📍 Landmark</span>
      </div>
    </div>
  );
}

// ─── InfoWindow HTML builder ───────────────────────────────────────────────────
function propertyInfoHTML(prop, rank, total) {
  const price = prop.price > 0
    ? `£${prop.price.toLocaleString("en-GB")}${prop.listing_type === "rent" ? "/mo" : ""}`
    : null;
  return `
    <div style="font-family:Arial,sans-serif;min-width:190px;max-width:250px;line-height:1.4">
      <div style="font-weight:700;font-size:14px;margin-bottom:3px">${prop.name}</div>
      ${prop.location ? `<div style="font-size:11px;color:#777;margin-bottom:8px">${prop.location}</div>` : ""}
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px">
        ${price ? `<span style="font-size:13px;font-weight:700;color:#1a1a1a">${price}</span>` : ""}
        ${prop.bedrooms > 0 ? `<span style="font-size:12px;color:#555">🛏 ${prop.bedrooms}</span>` : ""}
        ${prop.bathrooms > 0 ? `<span style="font-size:12px;color:#555">🚿 ${prop.bathrooms}</span>` : ""}
        ${prop.size > 0 ? `<span style="font-size:12px;color:#555">${prop.size} ${prop.size_unit}</span>` : ""}
      </div>
      <div style="font-size:10px;color:#aaa;background:#f5f5f0;padding:4px 8px;display:inline-block">Rank #${rank} of ${total}</div>
      ${prop.website_link ? `<br/><a href="${prop.website_link}" target="_blank" style="font-size:11px;color:#b8860b;text-decoration:none;margin-top:8px;display:inline-block">View listing →</a>` : ""}
    </div>
  `;
}

// ─── Main MapView ─────────────────────────────────────────────────────────────
export default function MapView() {
  const { user } = useAuth();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);

  const [properties, setProperties] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [landmarks, setLandmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // geocoded positions keyed by property id
  const [propCoords, setPropCoords] = useState({});
  const [workplaceCoord, setWorkplaceCoord] = useState(null);
  const [landmarkCoords, setLandmarkCoords] = useState({});

  const [activeTab, setActiveTab] = useState("rent");
  const [sortBy, setSortBy] = useState("date_desc");
  const [filters, setFilters] = useState({});

  const workplaceAddress = getWorkplaceAddress(user);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLandmarks(getLandmarks(user));
    Promise.all([loadProperties(), loadCustomFields()]).then(([pRes, cfRes]) => {
      const props = pRes.data || [];
      setProperties(props);
      setCustomFields(cfRes.data || []);
      // Pre-populate coords from values stored during save — zero API calls for known properties
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

  // ── Boot Maps SDK ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!GMAPS_KEY) return;
    loadMapsSDK().then(() => setMapReady(true)).catch(() => setSdkError(true));
  }, []);

  // ── Init map instance ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 53.5, lng: -2.2 },
      zoom: 6,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "simplified" }] },
      ],
    });
    infoWindowRef.current = new window.google.maps.InfoWindow();
  }, [mapReady]);

  // ── Filtered + sorted list ─────────────────────────────────────────────────
  const displayed = useMemo(
    () => applySort(applyFilters(properties, filters, customFields, activeTab), sortBy),
    [properties, filters, customFields, activeTab, sortBy],
  );

  // ── Geocode missing property addresses ─────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const missing = displayed.filter(p => p.location && !propCoords[p.id]);
    if (!missing.length) return;
    setGeocoding(true);
    Promise.all(missing.map(async p => ({ id: p.id, coord: await geocodeAddress(p.location) })))
      .then(results => {
        setPropCoords(prev => {
          const next = { ...prev };
          results.forEach(({ id, coord }) => { if (coord) next[id] = coord; });
          return next;
        });
        setGeocoding(false);
      });
  }, [displayed, mapReady]);

  // ── Geocode workplace ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !workplaceAddress) return;
    geocodeAddress(workplaceAddress).then(setWorkplaceCoord);
  }, [mapReady, workplaceAddress]);

  // ── Geocode landmarks ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    landmarks.forEach(async l => {
      if (!landmarkCoords[l.id] && l.address) {
        const coord = await geocodeAddress(l.address);
        if (coord) setLandmarkCoords(prev => ({ ...prev, [l.id]: coord }));
      }
    });
  }, [mapReady, landmarks]);

  // ── Rebuild markers whenever inputs change ─────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    // Clear previous markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;
    const total = displayed.length;

    // Property pins
    displayed.forEach((prop, idx) => {
      const coord = propCoords[prop.id];
      if (!coord) return;

      const ratio = total > 1 ? idx / (total - 1) : 0;
      const color = rankColor(ratio);
      const size = rankSize(ratio);
      const rank = idx + 1;

      const marker = new window.google.maps.Marker({
        position: coord,
        map,
        icon: propertyMarkerIcon(color, size, String(rank)),
        title: prop.name,
        zIndex: total - idx + 10,
      });

      marker.addListener("click", () => {
        infoWindowRef.current.setContent(propertyInfoHTML(prop, rank, total));
        infoWindowRef.current.open(map, marker);
      });

      markersRef.current.push(marker);
      bounds.extend(coord);
      hasPoints = true;
    });

    // Workplace pin (gold) — use a fixed amber hex consistent with the accent colour
    if (workplaceCoord) {
      const marker = new window.google.maps.Marker({
        position: workplaceCoord,
        map,
        icon: specialMarkerIcon("🏢", "#b8860b", 36),
        title: "Workplace",
        zIndex: 9999,
      });
      marker.addListener("click", () => {
        infoWindowRef.current.setContent(`<div style="font-family:Arial,sans-serif"><strong>🏢 Workplace</strong><br/><span style="font-size:11px;color:#777">${workplaceAddress}</span></div>`);
        infoWindowRef.current.open(map, marker);
      });
      markersRef.current.push(marker);
      bounds.extend(workplaceCoord);
      hasPoints = true;
    }

    // Landmark pins (dark)
    landmarks.forEach(l => {
      const coord = landmarkCoords[l.id];
      if (!coord) return;
      const marker = new window.google.maps.Marker({
        position: coord,
        map,
        icon: specialMarkerIcon(l.icon, "#3a3a3a", 32),
        title: l.name,
        zIndex: 9998,
      });
      marker.addListener("click", () => {
        infoWindowRef.current.setContent(`<div style="font-family:Arial,sans-serif"><strong>${l.icon} ${l.name}</strong><br/><span style="font-size:11px;color:#777">${l.address}</span></div>`);
        infoWindowRef.current.open(map, marker);
      });
      markersRef.current.push(marker);
      bounds.extend(coord);
      hasPoints = true;
    });

    if (hasPoints && !bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 60, bottom: 40, left: 260, right: 40 });
    }
  }, [displayed, propCoords, workplaceCoord, landmarkCoords, mapReady]);

  // ── Save landmarks ─────────────────────────────────────────────────────────
  const handleSaveLandmarks = async (updated) => {
    await saveLandmarks(updated);
    setLandmarks(updated);
    // eagerly geocode any new ones
    updated.forEach(async l => {
      if (!landmarkCoords[l.id] && l.address) {
        const coord = await geocodeAddress(l.address);
        if (coord) setLandmarkCoords(prev => ({ ...prev, [l.id]: coord }));
      }
    });
  };

  // ── Fallbacks ──────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="text-center px-5 py-20">
        <h2 className="text-2xl font-normal text-foreground mb-3">Map View</h2>
        <p className="text-muted-foreground italic">Sign in to view your saved properties on a map.</p>
      </div>
    );
  }

  if (!GMAPS_KEY) {
    return (
      <div className="text-center px-5 py-20">
        <h2 className="text-2xl font-normal text-foreground mb-3">Map View</h2>
        <p className="text-muted-foreground mb-2">A Google Maps API key is required to use this page.</p>
        <p className="text-xs text-muted-foreground/70">Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to your environment variables.</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-117px)]">
      {/* Landmarks panel */}
      <LandmarksPanel
        landmarks={landmarks}
        onSave={handleSaveLandmarks}
        workplaceAddress={workplaceAddress}
      />

      {/* Map area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Map canvas */}
        <div ref={mapRef} className="w-full h-full" />

        {/* Controls overlay */}
        <MapControls
          customFields={customFields}
          sortBy={sortBy}
          onSort={setSortBy}
          filters={filters}
          onFilter={setFilters}
          activeTab={activeTab}
          onActiveTab={setActiveTab}
          total={displayed.length}
          geocoding={geocoding}
        />

        {/* Loading / geocoding toast */}
        {(loading || geocoding) && (
          <div className="absolute bottom-4 right-4 bg-card border border-border rounded-lg px-3.5 py-1.5 text-[11px] text-muted-foreground shadow-md">
            {loading ? "Loading properties…" : "Placing pins…"}
          </div>
        )}

        {/* No properties message */}
        {!loading && displayed.length === 0 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl px-8 py-6 text-center shadow-xl">
            <p className="text-muted-foreground italic m-0">
              {properties.filter(p => p.listing_type === activeTab).length === 0
                ? `No ${activeTab} properties saved yet. Add some in Gaff Tracker.`
                : "No properties match the current filters."}
            </p>
          </div>
        )}

        {/* SDK error */}
        {sdkError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background text-red-500 text-base text-center p-8">
            Failed to load Google Maps. Check your API key and network connection.
          </div>
        )}
      </div>
    </div>
  );
}
