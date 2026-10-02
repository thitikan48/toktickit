import { FormEvent, useState } from "react";
import { ApiError, AuthUser, login } from "./api.js";

interface LoginProps {
  onLoggedIn: (user: AuthUser) => void;
  notice?: string;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login({
  onLoggedIn,
  notice,
}: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");

    const errors: FieldErrors = {};

    if (!email.trim()) {
      errors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = "Enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setBusy(true);

    try {
      const user = await login(email.trim(), password);
      onLoggedIn(user);
    } catch (error) {
      // The email is kept; the password is cleared.
      setPassword("");

      if (error instanceof ApiError && error.status === 401) {
        setFormError("Invalid email or password.");
      } else if (
        error instanceof ApiError &&
        error.code === "ACCOUNT_INACTIVE"
      ) {
        setFormError(
          "This account is inactive. Contact an administrator."
        );
      } else {
        setFormError(
          "Unable to log in right now. Please try again."
        );
      }

      setBusy(false);
    }
  }

  return (
    <main
      className="min-vh-100"
      style={{ backgroundColor: "#F5F7F6" }}
    >
      <header
        className="text-white"
        style={{ backgroundColor: "#006B3C" }}
      >
        <div
          className="container py-3"
          style={{ maxWidth: 1200 }}
        >
          <strong className="fs-5">TokTickIT</strong>
        </div>
      </header>

      <div className="container py-5">
        <section
          className="card shadow-sm mx-auto"
          style={{
            maxWidth: 440,
            border: "1px solid #D6E0DA",
            borderRadius: 12,
          }}
        >
          <form
            className="p-4 p-md-5"
            onSubmit={handleSubmit}
            noValidate
            aria-busy={busy}
          >
            <h1 className="h3 mb-4 text-center">
              Log in to TokTickIT
            </h1>

            {notice && (
              <div className="alert alert-warning" role="alert">
                {notice}
              </div>
            )}

            {formError && (
              <div className="alert alert-danger" role="alert">
                {formError}
              </div>
            )}

            <div className="mb-3">
              <label htmlFor="login-email" className="form-label fw-semibold">
                Email <span className="text-danger">*</span>
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                className={`form-control ${
                  fieldErrors.email ? "is-invalid" : ""
                }`}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              {fieldErrors.email && (
                <div className="invalid-feedback">
                  {fieldErrors.email}
                </div>
              )}
            </div>

            <div className="mb-4">
              <label
                htmlFor="login-password"
                className="form-label fw-semibold"
              >
                Password <span className="text-danger">*</span>
              </label>
              <div className="input-group has-validation">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className={`form-control ${
                    fieldErrors.password ? "is-invalid" : ""
                  }`}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
                {fieldErrors.password && (
                  <div className="invalid-feedback">
                    {fieldErrors.password}
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-success w-100"
              style={{ backgroundColor: "#006B3C", borderColor: "#006B3C" }}
              disabled={busy}
            >
              {busy ? "Logging in…" : "Log in"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
