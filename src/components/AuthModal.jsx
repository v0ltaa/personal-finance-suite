import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Dialog, DialogHeader, DialogTitle, DialogBody } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export default function AuthModal({ onClose, auth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!supabase) {
    return (
      <Dialog open onClose={onClose} className="max-w-sm">
        <DialogHeader onClose={onClose}>
          <DialogTitle>Supabase Not Configured</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Set <code className="text-xs bg-muted px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> and{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> in a{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code> file to enable accounts.
          </p>
        </DialogBody>
      </Dialog>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = mode === "login"
      ? await auth.signIn(email, password)
      : await auth.signUp(email, password, username.trim() || undefined);
    setLoading(false);
    if (res.error) setError(res.error.message);
    else onClose();
  };

  return (
    <Dialog open onClose={onClose} className="max-w-sm">
      <DialogHeader onClose={onClose}>
        <DialogTitle>{mode === "login" ? "Sign In" : "Create Account"}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <Input
              type="text"
              placeholder="Display name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" variant="default" disabled={loading} className="w-full mt-1">
            {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Sign Up"}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <button
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
            className="text-xs font-semibold text-brand hover:text-brand/80 transition-colors"
          >
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </DialogBody>
    </Dialog>
  );
}
