import { useState } from "react";
import "./AdminAuth.css";

const PASSCODE = process.env.REACT_APP_PASSCODE;

export default function AdminAuth({ children }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem("chrema_admin") === "true"
  );

  const handleSubmit = () => {
    if (input === PASSCODE) {
      sessionStorage.setItem("chrema_admin", "true");
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
      setInput("");
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  if (authed) return children;

  return (
    <div className="auth-page">
      <div className="auth-box">
        <a href="/public" className="auth-logo">CHREMA</a>
        <h1 className="auth-title">Admin Access</h1>
        <p className="auth-sub">Enter the passcode to continue.</p>

        <div className={`auth-field ${error ? "auth-field--error" : ""}`}>
          <input
            className="auth-input"
            type="password"
            placeholder="Passcode"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            onKeyDown={handleKey}
            autoFocus
          />
        </div>

        {error && (
          <p className="auth-error">Incorrect passcode. Try again.</p>
        )}

        <button className="auth-btn" onClick={handleSubmit}>
          Enter →
        </button>
      </div>
    </div>
  );
}
