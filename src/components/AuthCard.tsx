import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";

interface AuthCardProps {
  onAuthSuccess: () => Promise<void>;
}

export function AuthCard({ onAuthSuccess }: AuthCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const credentials = { email, password };
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      setMessage("Account created. Check your inbox if email confirmation is enabled.");
    } else {
      await onAuthSuccess();
      setMessage("Logged in.");
    }

    setLoading(false);
  }

  return (
    <section className="auth-card">
      <div>
        <p className="eyebrow">TeeSheet</p>
        <h1>Track every round before the first tee shot.</h1>
        <p className="muted">
          Sign in to create and manage your golf rounds, and share them with your friends.
        </p>
      </div>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          <span>Email</span>
          <input
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <label>
          <span>Password</span>
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            minLength={6}
            required
          />
        </label>

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Working..." : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      <button
        className="text-button"
        type="button"
        onClick={() => {
          setMode((current) => (current === "login" ? "signup" : "login"));
          setError(null);
          setMessage(null);
        }}
      >
        {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
      </button>

      {message ? <p className="success-message">{message}</p> : null}
      {error ? <p className="error-message">{error}</p> : null}
    </section>
  );
}
