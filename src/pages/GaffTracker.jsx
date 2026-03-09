/**
 * Gaff Tracker — property dashboard
 *
 * Required Supabase setup (run in SQL editor):
 *
 * CREATE TABLE properties (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id UUID REFERENCES auth.users NOT NULL,
 *   name TEXT NOT NULL,
 *   property_type TEXT NOT NULL DEFAULT 'apartment',
 *   listing_type TEXT NOT NULL DEFAULT 'rent',
 *   bedrooms INTEGER DEFAULT 1,
 *   bathrooms NUMERIC DEFAULT 1,
 *   size NUMERIC, size_unit TEXT DEFAULT 'sqft',
 *   location TEXT, website_link TEXT, price NUMERIC,
 *   notes TEXT, photo_url TEXT,
 *   custom_values JSONB DEFAULT '{}',
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "own" ON properties FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
 *
 * CREATE TABLE custom_fields (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id UUID REFERENCES auth.users NOT NULL,
 *   name TEXT NOT NULL, field_type TEXT NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "own" ON custom_fields FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
 *
 * Also create a storage bucket named "property-photos" with public access.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { C, fonts, fmt } from "../lib/tokens";
import { useIsMobile, useAuth } from "../lib/hooks";
import {
  loadProperties, saveProperty, updateProperty, deleteProperty, uploadPropertyPhoto,
  loadCustomFields, saveCustomField, deleteCustomField,
  saveWorkplaceAddress, getWorkplaceAddress,
} from "../lib/supabase";

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

// ─── Shared styles ────────────────────────────────────────────────────────────
const s = {
  label: { fontSize: 10, fontFamily: fonts.sans, fontWeight: 600, color: C.textLight, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 6 },
  sectionHead: { fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, fontFamily: fonts.sans, color: C.accent, borderBottom: `1px solid ${C.border}`, paddingBottom: 8, marginBottom: 18 },
  textInput: { width: "100%", background: "transparent", border: "none", borderBottom: `1.5px solid ${C.border}`, outline: "none", padding: "7px 0", fontFamily: fonts.serif, fontSize: 16, color: C.text, boxSizing: "border-box" },
  textarea: { width: "100%", background: "transparent", border: `1.5px solid ${C.border}`, outline: "none", padding: "10px 12px", fontFamily: fonts.serif, fontSize: 14, color: C.text, boxSizing: "border-box", resize: "vertical", minHeight: 72, lineHeight: 1.5 },
  btn: (active) => ({ padding: "7px 16px", border: `1.5px solid ${active ? C.text : C.border}`, borderRadius: 0, background: active ? C.text : "transparent", color: active ? C.bg : C.textMid, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: fonts.sans, transition: "all 0.15s" }),
};

// ─── Favicon / site icon ──────────────────────────────────────────────────────
function SiteIcon({ url, size = 20 }) {
  const [err, setErr] = useState(false);
  if (!url) return null;
  let domain = "";
  try { domain = new URL(url).hostname; } catch { return null; }
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  if (err) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.textMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    );
  }
  return <img src={faviconUrl} width={size} height={size} style={{ display: "block" }} onError={() => setErr(true)} alt="" />;
}

// ─── Custom field input (dialog) ─────────────────────────────────────────────
function CustomFieldInput({ field, value, onChange }) {
  if (field.field_type === "checkbox") {
    const checked = !!value;
    return (
      <button type="button" onClick={() => onChange(!checked)} style={{
        display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none",
        cursor: "pointer", padding: 0, fontFamily: fonts.sans,
      }}>
        <div style={{
          width: 18, height: 18, border: `1.5px solid ${checked ? C.text : C.border}`,
          background: checked ? C.text : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}>
          {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        </div>
        <span style={{ fontSize: 13, color: C.textMid }}>{checked ? "Yes" : "No"}</span>
      </button>
    );
  }
  if (field.field_type === "ranking") {
    const v = value || 0;
    return (
      <div style={{ display: "flex", gap: 4 }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <button key={n} type="button" onClick={() => onChange(n === v ? 0 : n)} style={{
            width: 28, height: 28, border: `1.5px solid ${n <= v ? C.text : C.border}`,
            borderRadius: 0, background: n <= v ? C.text : "transparent",
            color: n <= v ? C.bg : C.textMid, fontSize: 10, fontWeight: 600, cursor: "pointer",
            fontFamily: fonts.sans, padding: 0,
          }}>{n}</button>
        ))}
      </div>
    );
  }
  if (field.field_type === "number") {
    return (
      <input type="number" value={value || ""} onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        style={{ ...s.textInput, maxWidth: 140 }} />
    );
  }
  // text
  return (
    <input type="text" value={value || ""} onChange={e => onChange(e.target.value)}
      style={s.textInput} placeholder="Enter text..." />
  );
}

// ─── Distance to work section ─────────────────────────────────────────────────
const TRAVEL_MODES = [
  { key: "WALKING", label: "Walk", icon: "🚶", gm: "walking" },
  { key: "DRIVING", label: "Drive", icon: "🚗", gm: "driving" },
  { key: "BICYCLING", label: "Cycle", icon: "🚲", gm: "bicycling" },
  { key: "TRANSIT", label: "Transit", icon: "🚌", gm: "transit" },
];

function mapsDirectionUrl(origin, dest, mode) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=${mode}`;
}

async function loadMapsSDK() {
  if (window.google?.maps?.DistanceMatrixService) return;
  return new Promise((resolve, reject) => {
    if (document.querySelector("[data-gmaps]")) {
      const t = setInterval(() => { if (window.google?.maps) { clearInterval(t); resolve(); } }, 100);
      return;
    }
    const sc = document.createElement("script");
    sc.setAttribute("data-gmaps", "1");
    sc.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}`;
    sc.onload = resolve; sc.onerror = reject;
    document.head.appendChild(sc);
  });
}

function DistanceSection({ location, workplaceAddress }) {
  const [distances, setDistances] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workplaceAddress || !location) return;
    if (!GMAPS_KEY) return;
    let cancelled = false;
    setLoading(true);
    loadMapsSDK().then(() => {
      if (cancelled) return;
      const svc = new window.google.maps.DistanceMatrixService();
      const results = {};
      let pending = TRAVEL_MODES.length;
      TRAVEL_MODES.forEach(({ key }) => {
        svc.getDistanceMatrix({ origins: [workplaceAddress], destinations: [location], travelMode: key },
          (resp, status) => {
            if (!cancelled) {
              if (status === "OK") {
                const el = resp.rows[0].elements[0];
                results[key] = el.status === "OK" ? { duration: el.duration.text, distance: el.distance.text } : null;
              }
            }
            if (--pending === 0 && !cancelled) { setDistances(results); setLoading(false); }
          });
      });
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [location, workplaceAddress]);

  if (!workplaceAddress) {
    return (
      <div style={{ fontSize: 12, color: C.textMid, fontFamily: fonts.serif, fontStyle: "italic" }}>
        Set your workplace address in Settings to see distances.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {TRAVEL_MODES.map(({ key, label, icon, gm }) => {
        const d = distances?.[key];
        return (
          <a key={key} href={mapsDirectionUrl(workplaceAddress, location, gm)} target="_blank" rel="noreferrer"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              padding: "10px 14px", border: `1.5px solid ${C.border}`, textDecoration: "none",
              background: C.card, minWidth: 80, transition: "border-color 0.15s",
            }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontSize: 10, fontFamily: fonts.sans, fontWeight: 600, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
            {loading && <span style={{ fontSize: 10, color: C.textFaint, fontFamily: fonts.sans }}>...</span>}
            {d && <span style={{ fontSize: 12, color: C.text, fontFamily: fonts.serif, fontWeight: 400 }}>{d.duration}</span>}
            {d && <span style={{ fontSize: 10, color: C.textMid, fontFamily: fonts.sans }}>{d.distance}</span>}
            {!loading && !d && distances && <span style={{ fontSize: 10, color: C.textFaint, fontFamily: fonts.sans }}>↗</span>}
            {!GMAPS_KEY && <span style={{ fontSize: 10, color: C.textFaint, fontFamily: fonts.sans }}>↗ Open</span>}
          </a>
        );
      })}
    </div>
  );
}

// ─── Property card ─────────────────────────────────────────────────────────────
function PropertyCard({ property: p, customFields, workplaceAddress, onEdit, onDelete, mobile }) {
  const [open, setOpen] = useState(false);
  const sizePerRoom = p.size && p.bedrooms > 0 ? (p.size / p.bedrooms).toFixed(1) : null;

  return (
    <div style={{ border: `1.5px solid ${open ? C.text : C.border}`, marginBottom: 8, transition: "border-color 0.2s" }}>
      {/* Collapsed bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, cursor: "pointer", background: C.card }}
        onClick={() => setOpen(!open)}>
        {/* Photo */}
        <div style={{ width: mobile ? 64 : 88, height: mobile ? 64 : 72, flexShrink: 0, overflow: "hidden", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textFaint} strokeWidth="1.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            {p.photo_url && <img src={p.photo_url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />}
          </div>
        </div>

        {/* Main info */}
        <div style={{ flex: 1, padding: mobile ? "10px 12px" : "12px 16px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{ fontFamily: fonts.serif, fontSize: mobile ? 15 : 17, color: C.text, fontWeight: 400 }}>{p.name}</span>
            <span style={{ fontSize: 9, fontFamily: fonts.sans, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 6px", background: p.property_type === "house" ? C.greenBg : C.accentLight, color: p.property_type === "house" ? C.green : C.accent, border: `1px solid ${p.property_type === "house" ? C.greenBorder : "rgba(184,134,11,0.2)"}` }}>
              {p.property_type}
            </span>
          </div>
          {p.location && <div style={{ fontSize: 11, color: C.textMid, fontFamily: fonts.sans, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.location}</div>}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {p.price > 0 && <span style={{ fontSize: 13, fontFamily: fonts.serif, color: C.text, fontWeight: 400 }}>{fmt(p.price)}{p.listing_type === "rent" ? "/mo" : ""}</span>}
            {p.bedrooms > 0 && <span style={{ fontSize: 11, color: C.textMid, fontFamily: fonts.sans }}>🛏 {p.bedrooms}</span>}
            {p.bathrooms > 0 && <span style={{ fontSize: 11, color: C.textMid, fontFamily: fonts.sans }}>🚿 {p.bathrooms}</span>}
            {p.size > 0 && <span style={{ fontSize: 11, color: C.textMid, fontFamily: fonts.sans }}>{p.size} {p.size_unit}</span>}
          </div>
        </div>

        {/* Right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, paddingRight: 12, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {p.website_link && (
            <a href={p.website_link} target="_blank" rel="noreferrer" title="View listing"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, padding: 0 }}>
              <SiteIcon url={p.website_link} size={18} />
            </a>
          )}
          <button onClick={() => onEdit(p)} style={{ width: 32, height: 32, border: "none", background: "transparent", cursor: "pointer", color: C.textLight, fontSize: 12, fontFamily: fonts.sans }}>✎</button>
          <button onClick={() => { if (confirm(`Delete "${p.name}"?`)) onDelete(p.id); }} style={{ width: 32, height: 32, border: "none", background: "transparent", cursor: "pointer", color: C.red, fontSize: 14 }}>×</button>
        </div>
        <div style={{ paddingRight: 12, color: C.textMid, fontSize: 14, transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform 0.2s", flexShrink: 0, pointerEvents: "none" }}>▾</div>
      </div>

      {/* Expanded content */}
      {open && (
        <div style={{ borderTop: `1px solid ${C.borderLight}`, padding: mobile ? "20px 16px" : "24px 20px", background: C.bg }}>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 32 }}>
            {/* Left: map + distance */}
            <div>
              {p.location && (
                <>
                  <div style={s.sectionHead}>Location</div>
                  <div style={{ fontSize: 13, color: C.textMid, fontFamily: fonts.serif, marginBottom: 12 }}>{p.location}</div>
                  <div style={{ marginBottom: 24, border: `1px solid ${C.borderLight}`, overflow: "hidden" }}>
                    <iframe
                      title="map"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(p.location)}&output=embed&z=14&hl=en`}
                      width="100%" height="200" style={{ border: 0, display: "block" }} loading="lazy"
                    />
                  </div>
                  <div style={s.sectionHead}>Distance to Work</div>
                  <DistanceSection location={p.location} workplaceAddress={workplaceAddress} />
                </>
              )}
            </div>

            {/* Right: details + custom fields + notes */}
            <div>
              {/* Property details */}
              <div style={s.sectionHead}>Details</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginBottom: 24 }}>
                {[
                  ["Price", p.price > 0 ? `${fmt(p.price)}${p.listing_type === "rent" ? "/mo" : ""}` : "—"],
                  ["Type", p.property_type],
                  ["Bedrooms", p.bedrooms || "—"],
                  ["Bathrooms", p.bathrooms || "—"],
                  p.size > 0 && ["Size", `${p.size} ${p.size_unit}`],
                  sizePerRoom && ["Per Bedroom", `${sizePerRoom} ${p.size_unit}`],
                ].filter(Boolean).map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: fonts.sans, color: C.textLight, marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 14, fontFamily: fonts.serif, color: C.text }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Things I care about */}
              {customFields.length > 0 && (
                <>
                  <div style={s.sectionHead}>Things I Care About</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", marginBottom: 24 }}>
                    {customFields.map(f => {
                      const val = p.custom_values?.[f.id];
                      if (val === undefined || val === null || val === "") return null;
                      return (
                        <div key={f.id}>
                          <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: fonts.sans, color: C.textLight, marginBottom: 3 }}>{f.name}</div>
                          {f.field_type === "checkbox" && <div style={{ fontSize: 14, color: val ? C.green : C.red }}>{val ? "✓ Yes" : "✗ No"}</div>}
                          {f.field_type === "ranking" && (
                            <div style={{ display: "flex", gap: 2 }}>
                              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                                <div key={n} style={{ width: 14, height: 14, background: n <= val ? C.text : C.borderLight }} />
                              ))}
                              <span style={{ fontSize: 12, fontFamily: fonts.serif, marginLeft: 6, color: C.text }}>{val}/10</span>
                            </div>
                          )}
                          {(f.field_type === "number" || f.field_type === "text") && <div style={{ fontSize: 14, fontFamily: fonts.serif, color: C.text }}>{val}</div>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Notes */}
              {p.notes && (
                <>
                  <div style={s.sectionHead}>Notes</div>
                  <p style={{ fontSize: 14, fontFamily: fonts.serif, color: C.textMid, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{p.notes}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Property dialog ──────────────────────────────────────────────────────────
const EMPTY_FORM = { name: "", property_type: "apartment", listing_type: "rent", bedrooms: 2, bathrooms: 1, size: "", size_unit: "sqft", location: "", price: "", website_link: "", notes: "", custom_values: {} };

function PropertyDialog({ property, customFields, defaultListingType, onSave, onClose, mobile, userId }) {
  const [form, setForm] = useState(property ? { ...EMPTY_FORM, ...property, size: property.size || "", price: property.price || "" } : { ...EMPTY_FORM, listing_type: defaultListingType });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(property?.photo_url || null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const fileRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCustom = (fieldId, v) => setForm(f => ({ ...f, custom_values: { ...f.custom_values, [fieldId]: v } }));

  const sizePerRoom = form.size > 0 && form.bedrooms > 0 ? (Number(form.size) / Number(form.bedrooms)).toFixed(1) : "";

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.location.trim()) e.location = "Required";
    if (!form.bedrooms || form.bedrooms < 1) e.bedrooms = "Required";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSaving(true);

    const payload = { ...form, size: form.size === "" ? null : Number(form.size), price: form.price === "" ? null : Number(form.price) };
    delete payload.id; delete payload.user_id; delete payload.created_at; delete payload.updated_at;

    let photoUrl = form.photo_url || null;
    let saveError = null;

    if (property) {
      // Editing
      if (photoFile) {
        const { url, error: uploadErr } = await uploadPropertyPhoto(userId, property.id, photoFile);
        if (uploadErr) { setSaving(false); setErrors({ _save: "Photo upload failed: " + (uploadErr.message || "check your Supabase storage bucket") }); return; }
        if (url) photoUrl = url;
      }
      const { error } = await updateProperty(property.id, { ...payload, photo_url: photoUrl });
      saveError = error;
    } else {
      // Creating
      const { data, error } = await saveProperty({ ...payload, photo_url: photoUrl });
      saveError = error;
      if (!error && data && photoFile) {
        const { url, error: uploadErr } = await uploadPropertyPhoto(userId, data.id, photoFile);
        if (uploadErr) { setSaving(false); setErrors({ _save: "Property saved but photo upload failed: " + (uploadErr.message || "check your Supabase storage bucket") }); return; }
        if (url) await updateProperty(data.id, { photo_url: url });
      }
    }

    setSaving(false);
    if (saveError) { setErrors({ _save: saveError.message || "Save failed" }); return; }
    onSave();
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const grid2 = { display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "16px 24px", marginBottom: 16 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "24px 16px" }}>
      <div style={{ background: C.card, width: "100%", maxWidth: 640, boxShadow: "0 16px 64px rgba(0,0,0,0.18)", position: "relative", marginBottom: 24 }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontFamily: fonts.serif, fontWeight: 400, color: C.text, margin: 0, fontSize: 20 }}>{property ? "Edit Property" : "Add Property"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: C.textLight, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: "24px" }}>
          {/* Photo upload */}
          <div style={{ marginBottom: 24 }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{ width: "100%", height: 160, border: `1.5px dashed ${C.border}`, cursor: "pointer", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, position: "relative" }}
            >
              {photoPreview
                ? <img src={photoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (
                  <div style={{ textAlign: "center", color: C.textLight }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ marginBottom: 8 }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <div style={{ fontSize: 11, fontFamily: fonts.sans, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>Click to upload photo</div>
                  </div>
                )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
          </div>

          {/* Listing type & property type */}
          <div style={{ ...grid2, marginBottom: 20 }}>
            <div>
              <label style={s.label}>Listing Type *</label>
              <div style={{ display: "flex", gap: 0 }}>
                {["rent", "buy"].map(t => (
                  <button key={t} type="button" onClick={() => set("listing_type", t)} style={{ ...s.btn(form.listing_type === t), flex: 1, textTransform: "capitalize", borderRight: t === "rent" ? "none" : undefined }}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={s.label}>Property Type *</label>
              <div style={{ display: "flex", gap: 0 }}>
                {["apartment", "house"].map(t => (
                  <button key={t} type="button" onClick={() => set("property_type", t)} style={{ ...s.btn(form.property_type === t), flex: 1, textTransform: "capitalize", borderRight: t === "apartment" ? "none" : undefined }}>{t}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Name + location */}
          <div style={grid2}>
            <div>
              <label style={s.label}>Property Name *</label>
              <input type="text" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. 14 Oak Street" style={{ ...s.textInput, borderBottomColor: errors.name ? C.red : C.border }} />
              {errors.name && <div style={{ fontSize: 10, color: C.red, fontFamily: fonts.sans, marginTop: 3 }}>{errors.name}</div>}
            </div>
            <div>
              <label style={s.label}>Location *</label>
              <input type="text" value={form.location} onChange={e => set("location", e.target.value)} placeholder="Postcode or address" style={{ ...s.textInput, borderBottomColor: errors.location ? C.red : C.border }} />
              {errors.location && <div style={{ fontSize: 10, color: C.red, fontFamily: fonts.sans, marginTop: 3 }}>{errors.location}</div>}
            </div>
          </div>

          {/* Bedrooms + bathrooms */}
          <div style={grid2}>
            <div>
              <label style={s.label}>Bedrooms *</label>
              <input type="number" min={0} value={form.bedrooms} onChange={e => set("bedrooms", Number(e.target.value))} style={{ ...s.textInput, borderBottomColor: errors.bedrooms ? C.red : C.border, maxWidth: 100 }} />
            </div>
            <div>
              <label style={s.label}>Bathrooms</label>
              <input type="number" min={0} step={0.5} value={form.bathrooms} onChange={e => set("bathrooms", Number(e.target.value))} style={{ ...s.textInput, maxWidth: 100 }} />
            </div>
          </div>

          {/* Size + size per room */}
          <div style={grid2}>
            <div>
              <label style={s.label}>Size</label>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <input type="number" min={0} value={form.size} onChange={e => set("size", e.target.value)} placeholder="0" style={{ ...s.textInput, width: 100, flex: "none" }} />
                <div style={{ display: "flex", gap: 0, marginBottom: 2 }}>
                  {["sqft", "sqm"].map(u => (
                    <button key={u} type="button" onClick={() => set("size_unit", u)} style={{ ...s.btn(form.size_unit === u), fontSize: 10, padding: "4px 10px", borderRight: u === "sqft" ? "none" : undefined }}>{u}</button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label style={s.label}>Size per Bedroom</label>
              <div style={{ borderBottom: `1.5px solid ${C.borderLight}`, padding: "7px 0", fontSize: 16, fontFamily: fonts.serif, color: C.textMid }}>
                {sizePerRoom ? `${sizePerRoom} ${form.size_unit}` : "—"}
              </div>
              <div style={{ fontSize: 10, fontFamily: fonts.sans, color: C.textFaint, marginTop: 3 }}>Read only · auto-calculated</div>
            </div>
          </div>

          {/* Price + website */}
          <div style={grid2}>
            <div>
              <label style={s.label}>{form.listing_type === "rent" ? "Monthly Rent" : "Asking Price"}</label>
              <div style={{ display: "flex", alignItems: "center", borderBottom: `1.5px solid ${C.border}`, padding: "7px 0" }}>
                <span style={{ color: C.textLight, fontFamily: fonts.serif, marginRight: 4 }}>£</span>
                <input type="number" min={0} value={form.price} onChange={e => set("price", e.target.value)} style={{ background: "transparent", border: "none", outline: "none", fontFamily: fonts.serif, fontSize: 16, color: C.text, width: "100%" }} />
              </div>
            </div>
            <div>
              <label style={s.label}>Listing Link</label>
              <input type="url" value={form.website_link} onChange={e => set("website_link", e.target.value)} placeholder="https://www.rightmove.co.uk/..." style={s.textInput} />
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 24 }}>
            <label style={s.label}>Notes</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} style={s.textarea} placeholder="Anything worth noting..." />
          </div>

          {/* Custom fields */}
          {customFields.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={s.sectionHead}>Things I Care About</div>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "16px 24px" }}>
                {customFields.map(f => (
                  <div key={f.id}>
                    <label style={{ ...s.label, marginBottom: 8 }}>{f.name}</label>
                    <CustomFieldInput field={f} value={form.custom_values?.[f.id]} onChange={v => setCustom(f.id, v)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save error */}
          {errors._save && <div style={{ marginBottom: 12, padding: "10px 12px", background: "#fee2e2", color: "#b91c1c", fontFamily: fonts.sans, fontSize: 12 }}>{errors._save}</div>}

          {/* Save/Cancel */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "12px", border: "none", background: C.text, color: C.bg, fontSize: 12, fontWeight: 700, fontFamily: fonts.sans, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving..." : property ? "Update Property" : "Add Property"}
            </button>
            <button onClick={onClose} style={{ flex: 1, padding: "12px", border: `1.5px solid ${C.border}`, background: "transparent", color: C.textMid, fontSize: 12, fontWeight: 600, fontFamily: fonts.sans, cursor: "pointer", textTransform: "uppercase" }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Settings panel ────────────────────────────────────────────────────────────
function SettingsPanel({ customFields, onFieldAdded, onFieldDeleted, workplaceAddress, onWorkplaceChange, mobile }) {
  const [open, setOpen] = useState(false);
  const [wpEdit, setWpEdit] = useState(workplaceAddress);
  const [wpSaving, setWpSaving] = useState(false);
  const [addingField, setAddingField] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("checkbox");

  const handleSaveWorkplace = async () => {
    setWpSaving(true);
    await saveWorkplaceAddress(wpEdit);
    onWorkplaceChange(wpEdit);
    setWpSaving(false);
  };

  const handleAddField = async () => {
    if (!newFieldName.trim()) return;
    const { data } = await saveCustomField(newFieldName.trim(), newFieldType);
    if (data) { onFieldAdded(data); setNewFieldName(""); setAddingField(false); }
  };

  const FIELD_TYPES = [{ value: "checkbox", label: "Checkbox (Yes/No)" }, { value: "number", label: "Number" }, { value: "text", label: "Text" }, { value: "ranking", label: "Ranking (1–10)" }];

  return (
    <div style={{ marginBottom: 24, border: `1px solid ${C.border}`, background: C.card }}>
      <div onClick={() => setOpen(!open)} style={{ padding: "12px 16px", cursor: "pointer", userSelect: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, color: C.textMid, fontFamily: fonts.sans }}>Settings</span>
        <span style={{ color: C.textFaint, fontSize: 13, transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform 0.2s" }}>▾</span>
      </div>
      {open && (
        <div style={{ padding: "4px 16px 20px", borderTop: `1px solid ${C.borderLight}` }}>
          {/* Workplace address */}
          <div style={{ marginTop: 16, marginBottom: 24 }}>
            <div style={s.sectionHead}>Workplace Address</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Address / Postcode</label>
                <input type="text" value={wpEdit} onChange={e => setWpEdit(e.target.value)} placeholder="e.g. EC1A 1BB or 1 Paternoster Sq, London" style={s.textInput} />
              </div>
              <button onClick={handleSaveWorkplace} disabled={wpSaving} style={{ ...s.btn(true), marginBottom: 2, padding: "8px 16px", whiteSpace: "nowrap" }}>
                {wpSaving ? "Saving..." : "Save"}
              </button>
            </div>
            {!GMAPS_KEY && <div style={{ fontSize: 11, color: C.textMid, fontFamily: fonts.serif, fontStyle: "italic", marginTop: 8 }}>Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to your env to auto-compute travel times. Without it, clicking a travel mode opens Google Maps directions.</div>}
          </div>

          {/* Custom fields */}
          <div>
            <div style={{ ...s.sectionHead, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "none", paddingBottom: 0, marginBottom: 0 }}>
              <span>Things I Care About</span>
              <button onClick={() => setAddingField(!addingField)} style={{ fontSize: 10, background: "transparent", border: `1px solid ${C.border}`, padding: "3px 10px", cursor: "pointer", fontFamily: fonts.sans, fontWeight: 700, color: C.textMid }}>
                {addingField ? "Cancel" : "+ Add"}
              </button>
            </div>
            <div style={{ borderBottom: `1px solid ${C.border}`, marginBottom: 14, marginTop: 8 }} />

            {addingField && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: mobile ? "wrap" : "nowrap" }}>
                <input type="text" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="e.g. Has bathtub" style={{ ...s.textInput, flex: 1, minWidth: 120 }} />
                <select value={newFieldType} onChange={e => setNewFieldType(e.target.value)} style={{ border: `1.5px solid ${C.border}`, background: C.card, padding: "7px 10px", fontFamily: fonts.sans, fontSize: 12, color: C.text, outline: "none" }}>
                  {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button onClick={handleAddField} style={{ ...s.btn(true), whiteSpace: "nowrap", padding: "7px 16px" }}>Add</button>
              </div>
            )}

            {customFields.length === 0 && !addingField && (
              <p style={{ fontSize: 13, fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic", margin: 0 }}>No custom fields yet. Click "+ Add" to create one.</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {customFields.map(f => (
                <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.borderLight}` }}>
                  <div>
                    <span style={{ fontFamily: fonts.serif, fontSize: 14, color: C.text }}>{f.name}</span>
                    <span style={{ fontSize: 9, fontFamily: fonts.sans, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.1em", marginLeft: 8 }}>{FIELD_TYPES.find(t => t.value === f.field_type)?.label || f.field_type}</span>
                  </div>
                  <button onClick={async () => { await deleteCustomField(f.id); onFieldDeleted(f.id); }} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sort / filter bar ─────────────────────────────────────────────────────────
function SortFilterBar({ customFields, sortBy, onSort, filters, onFilter, mobile }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const rankingFields = customFields.filter(f => f.field_type === "ranking");
  const numberFields = customFields.filter(f => f.field_type === "number");

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

  const inputStyle = { border: `1.5px solid ${C.border}`, background: C.card, padding: "5px 8px", fontFamily: fonts.sans, fontSize: 12, color: C.text, outline: "none", width: 70 };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select value={sortBy} onChange={e => onSort(e.target.value)} style={{ border: `1.5px solid ${C.border}`, background: C.card, padding: "6px 10px", fontFamily: fonts.sans, fontSize: 11, color: C.text, outline: "none", cursor: "pointer" }}>
          {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={() => setFiltersOpen(!filtersOpen)} style={{ ...s.btn(filtersOpen), fontSize: 10, padding: "6px 12px" }}>
          Filters {filtersOpen ? "▴" : "▾"}
        </button>
        {Object.values(filters).some(v => v !== "" && v !== undefined) && (
          <button onClick={() => onFilter({})} style={{ fontSize: 10, background: "transparent", border: "none", color: C.accent, cursor: "pointer", fontFamily: fonts.sans, fontWeight: 600 }}>Clear filters</button>
        )}
      </div>
      {filtersOpen && (
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
              <div style={{ fontSize: 9, fontFamily: fonts.sans, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textLight, marginBottom: 4 }}>Min {f.name} score</div>
              <input type="number" min={1} max={10} value={filters[`rank_${f.id}`] || ""} onChange={e => onFilter({ ...filters, [`rank_${f.id}`]: e.target.value })} style={inputStyle} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function GaffTracker() {
  const mobile = useIsMobile();
  const { user } = useAuth();

  const [properties, setProperties] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("rent"); // "rent" | "buy"
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [sortBy, setSortBy] = useState("date_desc");
  const [filters, setFilters] = useState({});
  const [workplaceAddress, setWorkplaceAddress] = useState(getWorkplaceAddress(user));

  useEffect(() => {
    if (user) setWorkplaceAddress(getWorkplaceAddress(user));
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([loadProperties(), loadCustomFields()]).then(([pRes, cfRes]) => {
      setProperties(pRes.data || []);
      setCustomFields(cfRes.data || []);
      setLoading(false);
    });
  }, [user]);

  const refresh = async () => {
    const { data } = await loadProperties();
    setProperties(data || []);
  };

  const handleDelete = async (id) => {
    await deleteProperty(id);
    setProperties(ps => ps.filter(p => p.id !== id));
  };

  // Filter + sort
  const displayed = useMemo(() => {
    let list = properties.filter(p => p.listing_type === activeTab);

    if (filters.minBeds) list = list.filter(p => p.bedrooms >= Number(filters.minBeds));
    if (filters.maxBeds) list = list.filter(p => p.bedrooms <= Number(filters.maxBeds));
    if (filters.maxPrice) list = list.filter(p => !p.price || p.price <= Number(filters.maxPrice));
    customFields.forEach(f => {
      if (f.field_type === "number" && filters[`num_${f.id}`]) list = list.filter(p => (p.custom_values?.[f.id] || 0) >= Number(filters[`num_${f.id}`]));
      if (f.field_type === "ranking" && filters[`rank_${f.id}`]) list = list.filter(p => (p.custom_values?.[f.id] || 0) >= Number(filters[`rank_${f.id}`]));
    });

    list = [...list].sort((a, b) => {
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
    return list;
  }, [properties, activeTab, sortBy, filters, customFields]);

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <h2 style={{ fontFamily: fonts.serif, fontWeight: 400, color: C.text, marginBottom: 12 }}>Gaff Tracker</h2>
        <p style={{ fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic" }}>Sign in to track properties.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Title + add button */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: fonts.serif, fontWeight: 400, color: C.text, margin: "0 0 4px 0", fontSize: mobile ? 24 : 32 }}>Gaff Tracker</h2>
          <p style={{ fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic", margin: 0 }}>Track and compare properties you're considering.</p>
        </div>
        <button onClick={() => { setEditingProperty(null); setDialogOpen(true); }} style={{ padding: "10px 20px", border: "none", background: C.text, color: C.bg, fontSize: 12, fontWeight: 700, fontFamily: fonts.sans, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
          + Add Property
        </button>
      </div>

      {/* Settings */}
      <SettingsPanel
        customFields={customFields}
        onFieldAdded={f => setCustomFields(prev => [...prev, f])}
        onFieldDeleted={id => setCustomFields(prev => prev.filter(f => f.id !== id))}
        workplaceAddress={workplaceAddress}
        onWorkplaceChange={setWorkplaceAddress}
        mobile={mobile}
      />

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
          {displayed.length} propert{displayed.length === 1 ? "y" : "ies"}
        </span>
      </div>

      {/* Sort/filter */}
      <SortFilterBar customFields={customFields} sortBy={sortBy} onSort={setSortBy} filters={filters} onFilter={setFilters} mobile={mobile} />

      {/* Property list */}
      {loading && <div style={{ color: C.textLight, fontFamily: fonts.serif }}>Loading...</div>}

      {!loading && displayed.length === 0 && (
        <div style={{ padding: "48px 24px", border: `1.5px dashed ${C.border}`, textAlign: "center" }}>
          <p style={{ fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic", margin: "0 0 16px" }}>
            {properties.filter(p => p.listing_type === activeTab).length === 0
              ? `No ${activeTab} properties yet. Click "+ Add Property" to get started.`
              : "No properties match the current filters."}
          </p>
        </div>
      )}

      {!loading && displayed.map(p => (
        <PropertyCard
          key={p.id}
          property={p}
          customFields={customFields}
          workplaceAddress={workplaceAddress}
          onEdit={prop => { setEditingProperty(prop); setDialogOpen(true); }}
          onDelete={handleDelete}
          mobile={mobile}
        />
      ))}

      {/* Footer */}
      <div style={{ marginTop: 48, borderTop: `2px solid ${C.text}`, paddingTop: 16, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: C.textLight, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>Personal Finance Suite</span>
        <span style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.15em", textTransform: "uppercase" }}>Gaff Tracker</span>
      </div>

      {/* Dialog */}
      {dialogOpen && (
        <PropertyDialog
          property={editingProperty}
          customFields={customFields}
          defaultListingType={activeTab}
          userId={user?.id}
          onSave={() => { setDialogOpen(false); refresh(); }}
          onClose={() => setDialogOpen(false)}
          mobile={mobile}
        />
      )}
    </div>
  );
}
