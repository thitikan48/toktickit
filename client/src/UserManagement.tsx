import { FormEvent, useEffect, useState } from "react";
import {
  AdminUser,
  ApiError,
  UserRole,
  createUser,
  getUsers,
  setInitialPassword,
  updateUser,
} from "./api.js";
import Dialog from "./Dialog.js";

const ROLE_LABELS: Record<UserRole, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMIN: "Administrator",
};

const ROLE_STYLES: Record<UserRole, { background: string; color: string }> = {
  REQUESTER: { background: "#EEF3F0", color: "#1F3328" },
  IT_STAFF: { background: "#EAF6EF", color: "#006B3C" },
  ADMIN: { background: "#006B3C", color: "#FFFFFF" },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RoleBadge({ role }: { role: UserRole }) {
  const style = ROLE_STYLES[role];

  return (
    <span
      className="badge"
      style={{ backgroundColor: style.background, color: style.color }}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

function AccountBadge({ active }: { active: boolean }) {
  return (
    <span
      className="badge"
      style={
        active
          ? { backgroundColor: "#ECFDF3", color: "#067647" }
          : { backgroundColor: "#EEF3F0", color: "#66756D" }
      }
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function passwordProblem(password: string): string | null {
  if (password.length < 8 || password.length > 72) {
    return "Password must be 8-72 characters.";
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain at least one letter and one digit.";
  }

  return null;
}

type Errors = Partial<
  Record<"name" | "email" | "role" | "initialPassword", string>
>;

interface UserFormProps {
  /** null creates a new user. */
  user: AdminUser | null;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  onSetPassword: (user: AdminUser) => void;
}

function UserForm({
  user,
  isSelf,
  onClose,
  onSaved,
  onSetPassword,
}: UserFormProps) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<UserRole | "">(user?.role ?? "");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");

    const found: Errors = {};

    if (name.trim().length < 2 || name.trim().length > 100) {
      found.name = "Name must be between 2 and 100 characters.";
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      found.email = "Enter a valid email address.";
    }

    if (!role) {
      found.role = "Choose a role.";
    }

    if (!user) {
      const problem = passwordProblem(password);
      if (problem) found.initialPassword = problem;
    }

    setErrors(found);

    if (Object.keys(found).length > 0) {
      return;
    }

    setBusy(true);

    try {
      const values = {
        name: name.trim(),
        email: email.trim(),
        role: role as UserRole,
        isActive,
      };

      if (user) {
        await updateUser(user.id, values);
        onSaved("User updated.");
      } else {
        await createUser({ ...values, initialPassword: password });
        onSaved("User created.");
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setErrors({
          name: error.fields.name,
          email: error.fields.email,
          role: error.fields.role,
          initialPassword: error.fields.initialPassword,
        });
      } else if (error instanceof ApiError && error.fields.email) {
        setErrors({ email: error.fields.email });
      } else if (error instanceof ApiError && error.status === 409) {
        // For example: "At least one active Administrator is required."
        setFormError(error.message);
      } else {
        setFormError("Unable to save the user. Please try again.");
      }

      setBusy(false);
    }
  }

  return (
    <Dialog title={user ? "Edit User" : "Create User"} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate aria-busy={busy}>
        <div className="modal-body">
          {formError && (
            <div className="alert alert-danger" role="alert">
              {formError}
            </div>
          )}

          <div className="mb-3">
            <label htmlFor="user-name" className="form-label fw-semibold">
              Name <span className="text-danger">*</span>
            </label>
            <input
              id="user-name"
              className={`form-control ${errors.name ? "is-invalid" : ""}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {errors.name && (
              <div className="invalid-feedback">{errors.name}</div>
            )}
          </div>

          <div className="mb-3">
            <label htmlFor="user-email" className="form-label fw-semibold">
              Email <span className="text-danger">*</span>
            </label>
            <input
              id="user-email"
              type="email"
              className={`form-control ${errors.email ? "is-invalid" : ""}`}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {errors.email && (
              <div className="invalid-feedback">{errors.email}</div>
            )}
          </div>

          <div className="mb-3">
            <label htmlFor="user-role" className="form-label fw-semibold">
              Role <span className="text-danger">*</span>
            </label>
            <select
              id="user-role"
              className={`form-select ${errors.role ? "is-invalid" : ""}`}
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole | "")}
            >
              <option value="">Choose a role</option>
              <option value="REQUESTER">Requester</option>
              <option value="IT_STAFF">IT Staff</option>
              <option value="ADMIN">Administrator</option>
            </select>
            {errors.role && (
              <div className="invalid-feedback">{errors.role}</div>
            )}
          </div>

          <div className="form-check mb-3">
            <input
              id="user-active"
              type="checkbox"
              className="form-check-input"
              checked={isActive}
              disabled={isSelf}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <label htmlFor="user-active" className="form-check-label">
              Active
            </label>
            {isSelf && (
              <div className="form-text">
                You cannot deactivate your own account.
              </div>
            )}
          </div>

          {!user && (
            <div className="mb-3">
              <label htmlFor="user-password" className="form-label fw-semibold">
                Initial Password <span className="text-danger">*</span>
              </label>
              <div className="input-group has-validation">
                <input
                  id="user-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={`form-control ${
                    errors.initialPassword ? "is-invalid" : ""
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
                {errors.initialPassword && (
                  <div className="invalid-feedback">
                    {errors.initialPassword}
                  </div>
                )}
              </div>
              <div className="form-text">
                The user must change this password at first login.
              </div>
            </div>
          )}

          {user && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={busy}
              onClick={() => onSetPassword(user)}
            >
              Set New Initial Password
            </button>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-success"
            style={{ backgroundColor: "#006B3C", borderColor: "#006B3C" }}
            disabled={busy}
          >
            {busy ? "Saving…" : user ? "Save Changes" : "Create User"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function PasswordForm({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");

    const problem = passwordProblem(password);
    setError(problem ?? "");

    if (problem) return;

    setBusy(true);

    try {
      await setInitialPassword(user.id, password);
      onSaved(
        "Initial password set. The user must change it at the next login."
      );
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 400) {
        setError(failure.fields.initialPassword ?? "Invalid password.");
      } else {
        setFormError("Unable to set the password. Please try again.");
      }

      setBusy(false);
    }
  }

  return (
    <Dialog title="Set New Initial Password" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate aria-busy={busy}>
        <div className="modal-body">
          <p>
            New initial password for <strong>{user.name}</strong>. They must
            change it at their next login.
          </p>

          {formError && (
            <div className="alert alert-danger" role="alert">
              {formError}
            </div>
          )}

          <label htmlFor="new-initial-password" className="form-label fw-semibold">
            New Initial Password <span className="text-danger">*</span>
          </label>
          <div className="input-group has-validation">
            <input
              id="new-initial-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className={`form-control ${error ? "is-invalid" : ""}`}
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
            {error && <div className="invalid-feedback">{error}</div>}
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-success"
            style={{ backgroundColor: "#006B3C", borderColor: "#006B3C" }}
            disabled={busy}
          >
            {busy ? "Saving…" : "Set Password"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

interface UserManagementProps {
  currentUserId: number;
}

export default function UserManagement({
  currentUserId,
}: UserManagementProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState<{ user: AdminUser | null } | null>(null);
  const [passwordFor, setPasswordFor] = useState<AdminUser | null>(null);

  const hasFilters = Boolean(appliedSearch || role);

  // Search runs shortly after the user stops typing.
  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(false);

      try {
        const items = await getUsers({
          search: appliedSearch || undefined,
          role,
        });

        if (!cancelled) setUsers(items);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [appliedSearch, role, reload]);

  function clearFilters() {
    setSearch("");
    setAppliedSearch("");
    setRole("");
  }

  function saved(text: string) {
    setForm(null);
    setPasswordFor(null);
    setMessage(text);
    setReload((value) => value + 1);
  }

  return (
    <section className="container py-4" style={{ maxWidth: 1200 }}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div>
          <h1 className="h2 mb-1">User Management</h1>
          <p className="text-muted mb-0">
            Create accounts, assign one role, and activate or deactivate users.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-success"
          style={{ backgroundColor: "#006B3C", borderColor: "#006B3C" }}
          onClick={() => {
            setMessage("");
            setForm({ user: null });
          }}
        >
          + Create User
        </button>
      </div>

      {message && (
        <div className="alert alert-success" role="status">
          {message}
        </div>
      )}

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-6">
              <label htmlFor="userSearch" className="form-label fw-semibold">
                Search
              </label>
              <input
                id="userSearch"
                type="search"
                className="form-control"
                placeholder="Name or email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="col-8 col-md-4">
              <label htmlFor="userRole" className="form-label fw-semibold">
                Role
              </label>
              <select
                id="userRole"
                className="form-select"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole | "")}
              >
                <option value="">All roles</option>
                <option value="REQUESTER">Requester</option>
                <option value="IT_STAFF">IT Staff</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </div>
            <div className="col-4 col-md-2">
              <button
                type="button"
                className="btn btn-outline-secondary w-100"
                onClick={clearFilters}
                disabled={!hasFilters && search === ""}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-5" aria-busy="true">
          <div className="spinner-border mb-3" role="status" aria-hidden="true" />
          <p className="mb-0">Loading users...</p>
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-danger" role="alert">
          Unable to load users.{" "}
          <button
            type="button"
            className="btn btn-link p-0 align-baseline"
            onClick={() => setReload((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            {hasFilters ? (
              <>
                <p className="mb-3">No users match your search.</p>
                <button
                  type="button"
                  className="btn btn-outline-success"
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              </>
            ) : (
              <p className="mb-0">No users yet.</p>
            )}
          </div>
        </div>
      )}

      {!loading && !error && users.length > 0 && (
        <>
          {/* Desktop and tablet */}
          <div className="card shadow-sm overflow-hidden d-none d-md-block">
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="visually-hidden">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="fw-semibold">{user.name}</td>
                      <td className="text-break">{user.email}</td>
                      <td>
                        <RoleBadge role={user.role} />
                      </td>
                      <td>
                        <AccountBadge active={user.isActive} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm"
                          onClick={() => {
                            setMessage("");
                            setForm({ user });
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile */}
          <div className="d-md-none d-flex flex-column gap-3">
            {users.map((user) => (
              <div key={user.id} className="card shadow-sm">
                <div className="card-body">
                  <h2 className="h6 mb-1">{user.name}</h2>
                  <p className="text-muted small text-break mb-2">
                    {user.email}
                  </p>
                  <p className="mb-3 d-flex gap-2">
                    <RoleBadge role={user.role} />
                    <AccountBadge active={user.isActive} />
                  </p>
                  <button
                    type="button"
                    className="btn btn-outline-success w-100"
                    onClick={() => {
                      setMessage("");
                      setForm({ user });
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {form && !passwordFor && (
        <UserForm
          user={form.user}
          isSelf={form.user?.id === currentUserId}
          onClose={() => setForm(null)}
          onSaved={saved}
          onSetPassword={(user) => setPasswordFor(user)}
        />
      )}

      {passwordFor && (
        <PasswordForm
          user={passwordFor}
          onClose={() => setPasswordFor(null)}
          onSaved={saved}
        />
      )}
    </section>
  );
}
