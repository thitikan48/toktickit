import { FormEvent, useState } from "react";
import { ApiError, AuthUser, changePassword } from "./api.js";

interface ChangePasswordProps {
  /** First login: no navigation, the password change is required. */
  mandatory: boolean;
  onChanged: (user: AuthUser) => void;
  onCancel?: () => void;
}

interface FieldErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

function policyProblem(
  newPassword: string,
  currentPassword: string
): string | null {
  if (newPassword.length < 8 || newPassword.length > 72) {
    return "Password must be 8-72 characters.";
  }

  if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return "Password must contain at least one letter and one digit.";
  }

  if (newPassword === currentPassword) {
    return "New password must be different from the current password.";
  }

  return null;
}

export default function ChangePassword({
  mandatory,
  onChanged,
  onCancel,
}: ChangePasswordProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");

    const errors: FieldErrors = {};

    if (!currentPassword) {
      errors.currentPassword = "Current password is required.";
    }

    const problem = newPassword
      ? policyProblem(newPassword, currentPassword)
      : "New password is required.";

    if (problem) {
      errors.newPassword = problem;
    }

    if (confirmPassword !== newPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setBusy(true);

    try {
      const user = await changePassword(
        currentPassword,
        newPassword
      );
      onChanged(user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setFieldErrors({
          currentPassword: error.fields.currentPassword,
          newPassword: error.fields.newPassword,
        });
      } else {
        setFormError(
          "Unable to change the password right now. Please try again."
        );
      }

      setBusy(false);
    }
  }

  function field(
    id: string,
    label: string,
    value: string,
    setValue: (value: string) => void,
    error: string | undefined,
    autoComplete: string
  ) {
    return (
      <div className="mb-3">
        <label htmlFor={id} className="form-label fw-semibold">
          {label} <span className="text-danger">*</span>
        </label>
        <input
          id={id}
          type="password"
          autoComplete={autoComplete}
          className={`form-control ${error ? "is-invalid" : ""}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        {error && <div className="invalid-feedback">{error}</div>}
      </div>
    );
  }

  return (
    <div className="container py-5">
      <section
        className="card shadow-sm mx-auto"
        style={{
          maxWidth: 480,
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
          <h1 className="h3 mb-2">
            {mandatory ? "Choose a new password" : "Change Password"}
          </h1>

          <p className="text-muted">
            {mandatory
              ? "You must choose a new password before you can use TokTickIT."
              : "Enter your current password and choose a new one."}
          </p>

          <p className="small text-muted">
            Use 8-72 characters with at least one letter and one digit,
            different from your current password.
          </p>

          {formError && (
            <div className="alert alert-danger" role="alert">
              {formError}
            </div>
          )}

          {field(
            "current-password",
            "Current Password",
            currentPassword,
            setCurrentPassword,
            fieldErrors.currentPassword,
            "current-password"
          )}
          {field(
            "new-password",
            "New Password",
            newPassword,
            setNewPassword,
            fieldErrors.newPassword,
            "new-password"
          )}
          {field(
            "confirm-password",
            "Confirm New Password",
            confirmPassword,
            setConfirmPassword,
            fieldErrors.confirmPassword,
            "new-password"
          )}

          <div className="d-flex gap-2 mt-4">
            <button
              type="submit"
              className="btn btn-success"
              style={{ backgroundColor: "#006B3C", borderColor: "#006B3C" }}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save Password"}
            </button>

            {!mandatory && onCancel && (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={onCancel}
                disabled={busy}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
