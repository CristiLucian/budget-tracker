import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup
} from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "../firebase";

type Mode = "signin" | "signup";

function friendlyError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email sau parolă greșită.";
    case "auth/email-already-in-use":
      return "Există deja un cont cu acest email.";
    case "auth/weak-password":
      return "Parola trebuie să aibă cel puțin 6 caractere.";
    case "auth/invalid-email":
      return "Adresa de email nu este validă.";
    case "auth/too-many-requests":
      return "Prea multe încercări. Așteaptă puțin și încearcă din nou.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/network-request-failed":
      return "Fără conexiune. Verifică internetul și încearcă din nou.";
    default:
      return "A apărut o eroare. Încearcă din nou.";
  }
}

export default function Login() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function withBusy(fn: () => Promise<unknown>) {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      const msg = friendlyError((err as { code?: string })?.code ?? "");
      if (msg) setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    const auth = getFirebaseAuth();
    void withBusy(() =>
      mode === "signin"
        ? signInWithEmailAndPassword(auth, email.trim(), password)
        : createUserWithEmailAndPassword(auth, email.trim(), password)
    );
  }

  function google() {
    void withBusy(() => signInWithPopup(getFirebaseAuth(), googleProvider));
  }

  function resetPassword() {
    if (!email.trim()) {
      setError("Scrie adresa de email mai întâi.");
      return;
    }
    void withBusy(async () => {
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
      setInfo("Ți-am trimis un email pentru resetarea parolei.");
    });
  }

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <span className="login__logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="13" rx="3" />
              <path d="M3 10h18" opacity="0" />
              <path d="M16 12.5h2.5" />
              <path d="M7 6V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1" />
            </svg>
          </span>
          <h1>Buget</h1>
          <p className="muted">Bugetul tău personal, sincronizat pe toate dispozitivele.</p>
        </div>

        <button className="btn btn--google" onClick={google} disabled={busy}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.29 14.29A7.22 7.22 0 0 1 4.91 12c0-.8.14-1.57.38-2.29v-3.1H1.29a12 12 0 0 0 0 10.78l4-3.1Z" />
            <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.61l4 3.1C6.23 6.88 8.88 4.77 12 4.77Z" />
          </svg>
          Continuă cu Google
        </button>

        <div className="login__divider"><span>sau cu email</span></div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Parolă</span>
            <input
              className="input"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          {error && <div className="field-error" role="alert">{error}</div>}
          {info && <div className="field-info" role="status">{info}</div>}

          <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
            {mode === "signin" ? "Intră în cont" : "Creează cont"}
          </button>
        </form>

        <div className="login__links">
          {mode === "signin" ? (
            <>
              <button className="linklike" onClick={() => { setMode("signup"); setError(null); }}>
                Nu ai cont? Creează unul
              </button>
              <button className="linklike" onClick={resetPassword}>
                Am uitat parola
              </button>
            </>
          ) : (
            <button className="linklike" onClick={() => { setMode("signin"); setError(null); }}>
              Ai deja cont? Intră
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
