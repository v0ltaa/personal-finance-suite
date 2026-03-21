import { useState, useEffect } from "react";
import { loadAllScenarios, deleteScenario, saveScenario, loadScenarios } from "../lib/supabase";
import { Dialog, DialogHeader, DialogTitle, DialogBody } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Trash2, Upload } from "lucide-react";

export default function ScenarioManager({ onClose, onLoadScenario }) {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllScenarios().then(({ data }) => {
      setScenarios(data || []);
      setLoading(false);
    });
  }, []);

  const handleDelete = async (id) => {
    await deleteScenario(id);
    setScenarios((s) => s.filter((x) => x.id !== id));
  };

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <DialogHeader onClose={onClose}>
        <DialogTitle>Saved Scenarios</DialogTitle>
      </DialogHeader>
      <DialogBody>
        {loading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {!loading && scenarios.length === 0 && (
          <p className="text-sm font-serif italic text-muted-foreground">
            No saved scenarios yet. Use the Save button on each input section.
          </p>
        )}

        <div className="flex flex-col divide-y divide-border">
          {scenarios.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-serif text-foreground">{s.name}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                  {s.section} · {new Date(s.updated_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {onLoadScenario && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { onLoadScenario(s); onClose(); }}
                  >
                    <Upload size={12} /> Load
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(s.id)}
                  className="text-danger hover:text-danger hover:bg-danger/10"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogBody>
    </Dialog>
  );
}

export function SaveDialog({ section, config, onClose }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await saveScenario(name.trim(), section, config);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} className="max-w-sm">
      <DialogHeader onClose={onClose}>
        <DialogTitle>Save Configuration</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div className="flex flex-col gap-3">
          <Input
            type="text"
            placeholder="Scenario name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <div className="flex gap-2">
            <Button
              variant="default"
              className="flex-1"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogBody>
    </Dialog>
  );
}

export function LoadDialog({ section, onLoad, onClose }) {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScenarios(section).then(({ data }) => {
      setScenarios(data || []);
      setLoading(false);
    });
  }, [section]);

  return (
    <Dialog open onClose={onClose} className="max-w-sm">
      <DialogHeader onClose={onClose}>
        <DialogTitle>Load Configuration</DialogTitle>
      </DialogHeader>
      <DialogBody>
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && scenarios.length === 0 && (
          <p className="text-sm font-serif italic text-muted-foreground">No saved configs for this section.</p>
        )}
        <div className="flex flex-col gap-1.5">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => { onLoad(s.config); onClose(); }}
              className="w-full text-left px-4 py-3 rounded-lg border border-border hover:bg-muted transition-colors duration-150"
            >
              <p className="text-sm font-serif text-foreground">{s.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(s.updated_at).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
        <Button variant="outline" className="w-full mt-4" onClick={onClose}>
          Cancel
        </Button>
      </DialogBody>
    </Dialog>
  );
}
