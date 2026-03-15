import { useState, useEffect, useRef, useMemo } from "react";
import { C, fonts, fmt } from "../lib/tokens";
import { useAuth } from "../lib/hooks";
import {
  loadProperties, loadCustomFields,
  saveLandmarks, getLandmarks,
  getWorkplaceAddress,
} from "../lib/supabase";

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

// ─── Shared input style ────────────────────────────────────────────────────────
const inp = {
  border: `1.5px solid ${C.border}`, background: C.card, outline: "none",
  padding: "6px 10px", fontFamily: fonts.sans, fontSize: 12, color: C.text,
};

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
    <div style={{ background: C.card, borderBottom: `1.5px solid ${C.border}`, flexShrink: 0 }}>
      {/* Collapsed bar */}
      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 20px", cursor: "pointer", userSelect: "none", minHeight: 44 }}>
        <span style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, color: C.textMid, fontFamily: fonts.sans, flexShrink: 0 }}>Landmarks</span>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", flex: 1, overflow: "hidden" }}>
          {workplaceAddress && (
            <span style={{ fontSize: 11, color: C.textLight, fontFamily: fonts.sans, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
              🏢 <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", display: "inline-block" }}>{workplaceAddress}</span>
            </span>
          )}
          {landmarks.slice(0, 5).map(l => (
            <span key={l.id} style={{ fontSize: 11, color: C.textLight, fontFamily: fonts.sans, display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
              {l.icon} {l.name.length > 18 ? l.name.slice(0, 18) + "…" : l.name}
            </span>
          ))}
          {landmarks.length > 5 && <span style={{ fontSize: 10, color: C.textFaint, fontFamily: fonts.sans }}>+{landmarks.length - 5} more</span>}
          {!workplaceAddress && landmarks.length === 0 && (
            <span style={{ fontSize: 11, color: C.textFaint, fontFamily: fonts.serif, fontStyle: "italic" }}>None added yet — click to expand</span>
          )}
        </div>
        <span style={{ color: C.textFaint, fontSize: 13, transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform 0.2s", flexShrink: 0 }}>▾</span>
      </div>

      {/* Expanded */}
      {open && (
        <div style={{ padding: "4px 20px 16px", borderTop: `1px solid ${C.borderLight}` }}>
          {!workplaceAddress && (
            <p style={{ fontSize: 12, fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic", margin: "10px 0 12px" }}>
              Tip: Set your workplace address in Gaff Tracker → Settings to pin it on the map.
            </p>
          )}

          {/* Landmark chips */}
          {landmarks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 14px" }}>
              {landmarks.map(l => (
                <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", border: `1.5px solid ${C.border}`, background: C.bg, fontFamily: fonts.sans, fontSize: 12 }}>
                  <span>{l.icon}</span>
                  <span style={{ color: C.text, fontWeight: 600 }}>{l.name}</span>
                  <span style={{ color: C.textFaint, fontSize: 10 }}>{l.address.length > 28 ? l.address.slice(0, 28) + "…" : l.address}</span>
                  <button onClick={() => handleDelete(l.id)} style={{ border: "none", background: "none", color: C.red, cursor: "pointer", fontSize: 16, padding: "0 0 0 4px", lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          {adding ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <select value={newIcon} onChange={e => setNewIcon(e.target.value)} style={{ ...inp, width: 52 }}>
                {LANDMARK_ICONS.map(ic => <option key={ic.value} value={ic.value}>{ic.value} {ic.label}</option>)}
              </select>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name (e.g. Sister's school)" style={{ ...inp, width: 180 }} />
              <input type="text" value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Address or postcode" style={{ ...inp, flex: 1, minWidth: 200 }} onKeyDown={e => e.key === "Enter" && handleAdd()} />
              <button onClick={handleAdd} disabled={saving || !newName.trim() || !newAddress.trim()} style={{ padding: "6px 16px", background: C.text, color: C.bg, border: "none", fontSize: 11, fontWeight: 700, fontFamily: fonts.sans, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", opacity: saving ? 0.6 : 1 }}>
                {saving ? "…" : "Add"}
              </button>
              <button onClick={() => setAdding(false)} style={{ padding: "6px 12px", background: "transparent", color: C.textMid, border: `1px solid ${C.border}`, fontSize: 11, fontFamily: fonts.sans, cursor: "pointer" }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ fontSize: 10, background: "transparent", border: `1px solid ${C.border}`, padding: "5px 14px", cursor: "pointer", fontFamily: fonts.sans, fontWeight: 700, color: C.textMid, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              + Add Landmark
            </button>
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
  const numInp = { border: `1px solid ${C.border}`, background: "#fff", padding: "4px 7px", fontFamily: fonts.sans, fontSize: 11, color: C.text, outline: "none", width: 64 };

  return (
    <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10, width: 240 }}>
      <div style={{ background: C.card, border: `1.5px solid ${C.border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
        {/* Tab bar + toggle */}
        <div style={{ display: "flex", alignItems: "center", padding: "8px 10px", gap: 6, borderBottom: open ? `1px solid ${C.borderLight}` : "none" }}>
          {[{ key: "rent", label: "Rent" }, { key: "buy", label: "Buy" }].map(t => (
            <button key={t.key} onClick={() => onActiveTab(t.key)} style={{
              padding: "4px 14px", fontSize: 11, fontWeight: 600, fontFamily: fonts.sans,
              border: `1.5px solid ${activeTab === t.key ? C.text : C.border}`,
              background: activeTab === t.key ? C.text : "transparent",
              color: activeTab === t.key ? C.bg : C.textMid, cursor: "pointer",
            }}>{t.label}</button>
          ))}
          <span style={{ fontSize: 10, color: C.textFaint, fontFamily: fonts.sans, marginLeft: "auto" }}>
            {geocoding ? "…" : `${total} shown`}
          </span>
          <button onClick={() => setOpen(!open)} style={{ padding: "3px 8px", fontSize: 10, background: "transparent", border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: fonts.sans, color: C.textMid, marginLeft: 4 }}>
            {hasFilters ? "● " : ""}{open ? "▴" : "▾"}
          </button>
        </div>

        {/* Expanded controls */}
        {open && (
          <div style={{ padding: "12px 14px" }}>
            {/* Sort */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: C.accent, fontFamily: fonts.sans, marginBottom: 6 }}>
                Sort — affects pin size &amp; colour
              </div>
              <select value={sortBy} onChange={e => onSort(e.target.value)} style={{ ...numInp, width: "100%" }}>
                {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Filters */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: C.accent, fontFamily: fonts.sans }}>Filters</span>
                {hasFilters && <button onClick={() => onFilter({})} style={{ fontSize: 9, background: "none", border: "none", color: C.accent, cursor: "pointer", fontFamily: fonts.sans, fontWeight: 600 }}>Clear all</button>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 10px" }}>
                {[["Min beds", "minBeds"], ["Max beds", "maxBeds"], ["Max £", "maxPrice"]].map(([label, key]) => (
                  <div key={key}>
                    <div style={{ fontSize: 8, fontFamily: fonts.sans, color: C.textLight, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                    <input type="number" min={0} value={filters[key] || ""} onChange={e => onFilter({ ...filters, [key]: e.target.value })} style={numInp} />
                  </div>
                ))}
                {rankingFields.map(f => (
                  <div key={f.id}>
                    <div style={{ fontSize: 8, fontFamily: fonts.sans, color: C.textLight, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>Min {f.name}</div>
                    <input type="number" min={1} max={10} value={filters[`rank_${f.id}`] || ""} onChange={e => onFilter({ ...filters, [`rank_${f.id}`]: e.target.value })} style={numInp} />
                  </div>
                ))}
                {numberFields.map(f => (
                  <div key={f.id}>
                    <div style={{ fontSize: 8, fontFamily: fonts.sans, color: C.textLight, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>Min {f.name}</div>
                    <input type="number" min={0} value={filters[`num_${f.id}`] || ""} onChange={e => onFilter({ ...filters, [`num_${f.id}`]: e.target.value })} style={numInp} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rank legend */}
      <div style={{ marginTop: 8, background: C.card, border: `1px solid ${C.border}`, padding: "6px 10px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "hsl(120,78%,40%)", border: "2px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          <span style={{ fontSize: 9, fontFamily: fonts.sans, color: C.textMid }}>Best</span>
        </div>
        <div style={{ flex: 1, height: 5, background: "linear-gradient(to right, hsl(120,78%,40%), hsl(60,78%,42%), hsl(0,78%,40%))", borderRadius: 3 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "hsl(0,78%,40%)", border: "2px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          <span style={{ fontSize: 9, fontFamily: fonts.sans, color: C.textMid }}>Worst</span>
        </div>
      </div>

      {/* Key for special markers */}
      <div style={{ marginTop: 6, background: C.card, border: `1px solid ${C.border}`, padding: "6px 10px", display: "flex", gap: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <span style={{ fontSize: 9, fontFamily: fonts.sans, color: C.textMid, display: "flex", alignItems: "center", gap: 4 }}>🏢 Workplace</span>
        <span style={{ fontSize: 9, fontFamily: fonts.sans, color: C.textMid, display: "flex", alignItems: "center", gap: 4 }}>📍 Landmark</span>
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

    // Workplace pin (gold)
    if (workplaceCoord) {
      const marker = new window.google.maps.Marker({
        position: workplaceCoord,
        map,
        icon: specialMarkerIcon("🏢", C.accent, 36),
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
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <h2 style={{ fontFamily: fonts.serif, fontWeight: 400, color: C.text, marginBottom: 12 }}>Map View</h2>
        <p style={{ fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic" }}>Sign in to view your saved properties on a map.</p>
      </div>
    );
  }

  if (!GMAPS_KEY) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <h2 style={{ fontFamily: fonts.serif, fontWeight: 400, color: C.text, marginBottom: 12 }}>Map View</h2>
        <p style={{ fontFamily: fonts.serif, color: C.textMid, marginBottom: 8 }}>A Google Maps API key is required to use this page.</p>
        <p style={{ fontFamily: fonts.sans, fontSize: 12, color: C.textLight }}>Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to your environment variables.</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 117px)" }}>
      {/* Landmarks panel */}
      <LandmarksPanel
        landmarks={landmarks}
        onSave={handleSaveLandmarks}
        workplaceAddress={workplaceAddress}
      />

      {/* Map area */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Map canvas */}
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

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
          <div style={{
            position: "absolute", bottom: 16, right: 16,
            background: C.card, border: `1px solid ${C.border}`,
            padding: "6px 14px", fontFamily: fonts.sans, fontSize: 11,
            color: C.textMid, boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}>
            {loading ? "Loading properties…" : "Placing pins…"}
          </div>
        )}

        {/* No properties message */}
        {!loading && displayed.length === 0 && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            background: C.card, border: `1.5px solid ${C.border}`, padding: "24px 32px",
            textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          }}>
            <p style={{ fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic", margin: 0 }}>
              {properties.filter(p => p.listing_type === activeTab).length === 0
                ? `No ${activeTab} properties saved yet. Add some in Gaff Tracker.`
                : "No properties match the current filters."}
            </p>
          </div>
        )}

        {/* SDK error */}
        {sdkError && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: C.bg, fontFamily: fonts.serif, color: C.red, fontSize: 16, textAlign: "center",
            padding: 32,
          }}>
            Failed to load Google Maps. Check your API key and network connection.
          </div>
        )}
      </div>
    </div>
  );
}
