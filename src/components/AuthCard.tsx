import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { appBaseUrl, supabase } from "../lib/supabase";

type AuthMode = "login" | "signup" | "forgot" | "reset";

interface AuthCardProps {
  onAuthSuccess: () => Promise<void>;
  recoveryMode?: boolean;
  onPasswordResetComplete?: () => void;
}

export function AuthCard({
  onAuthSuccess,
  recoveryMode = false,
  onPasswordResetComplete
}: AuthCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>(recoveryMode ? "reset" : "login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(recoveryMode ? "reset" : "login");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setMessage(null);
  }, [recoveryMode]);

  function resetFeedback() {
    setError(null);
    setMessage(null);
  }

  function getResetRedirectUrl() {
    return appBaseUrl;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "forgot") {
        const { error: forgotPasswordError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getResetRedirectUrl()
        });

        if (forgotPasswordError) {
          throw forgotPasswordError;
        }

        setMessage("Password reset link sent. Check your inbox for the recovery email.");
        return;
      }

      if (mode === "reset") {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        const { error: updatePasswordError } = await supabase.auth.updateUser({ password });

        if (updatePasswordError) {
          throw updatePasswordError;
        }

        setConfirmPassword("");
        setMessage("Password updated. You can keep using TeeLogic with your new password.");
        onPasswordResetComplete?.();
        await onAuthSuccess();
        return;
      }

      const credentials = { email, password };
      const result =
        mode === "login"
          ? await supabase.auth.signInWithPassword(credentials)
          : await supabase.auth.signUp(credentials);

      if (result.error) {
        throw result.error;
      }

      if (mode === "signup") {
        setMessage("Account created. Check your inbox if email confirmation is enabled.");
      } else {
        await onAuthSuccess();
        setMessage("Logged in.");
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to continue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-card">
      <div>
        <p className="eyebrow">TeeLogic</p>
        <h1>Track every round before the first tee shot.</h1>
        <p className="muted">
          {mode === "forgot"
            ? "Enter your email and we'll send you a password reset link."
            : mode === "reset"
              ? "Choose a new password for your TeeLogic account."
              : "Sign in to create and manage your golf rounds, and share them with your friends."}
        </p>
      </div>

      <form className="stack" onSubmit={handleSubmit}>
        {mode !== "reset" ? (
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
        ) : null}

        {mode !== "forgot" ? (
          <label>
            <span>{mode === "reset" ? "New password" : "Password"}</span>
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
        ) : null}

        {mode === "reset" ? (
          <label>
            <span>Confirm new password</span>
            <input
              autoComplete="new-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Enter the new password again"
              minLength={6}
              required
            />
          </label>
        ) : null}

        <button className="primary-button" type="submit" disabled={loading}>
          {loading
            ? "Working..."
            : mode === "login"
              ? "Log in"
              : mode === "signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Update password"}
        </button>
      </form>

      {mode === "login" ? (
        <div className="auth-actions">
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setMode("forgot");
              resetFeedback();
            }}
          >
            Forgot your password?
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setMode("signup");
              resetFeedback();
            }}
          >
            Need an account? Sign up
          </button>
        </div>
      ) : null}

      {mode === "signup" ? (
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setMode("login");
            resetFeedback();
          }}
        >
          Already have an account? Log in
        </button>
      ) : null}

      {mode === "forgot" ? (
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setMode("login");
            resetFeedback();
          }}
        >
          Back to login
        </button>
      ) : null}

      {mode === "reset" ? (
        <p className="muted auth-reset-note">
          Opened the wrong link? Request another password reset from the login screen.
        </p>
      ) : null}

      {message ? <p className="success-message">{message}</p> : null}
      {error ? <p className="error-message">{error}</p> : null}
    </section>
  );
}
