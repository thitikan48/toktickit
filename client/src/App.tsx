import { useEffect, useState } from "react";
import {
  AuthUser,
  StaffTicketListItem,
  TicketListItem,
  UserRole,
  getCurrentUser,
  logout,
  setUnauthorizedHandler,
} from "./api.js";
import ChangePassword from "./ChangePassword.js";
import CreateTicket from "./CreateTicket.js";
import Login from "./Login.js";
import MyTickets from "./MyTickets.js";
import StaffTicketDetail from "./StaffTicketDetail.js";
import StaffTicketQueue from "./StaffTicketQueue.js";
import UserManagement from "./UserManagement.js";
import TicketDetail from "./TicketDetail.js";

type Screen =
  | "home"
  | "create"
  | "detail"
  | "change-password"
  | "queue"
  | "staff-detail"
  | "users";

const ROLE_LABELS: Record<UserRole, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMIN: "Administrator",
};

// Navigation allowed for each role (the backend enforces access as well).
const NAVIGATION: Record<
  UserRole,
  { screen: Screen; label: string }[]
> = {
  REQUESTER: [
    { screen: "home", label: "My Tickets" },
    { screen: "create", label: "Create Ticket" },
  ],
  IT_STAFF: [{ screen: "queue", label: "Ticket Queue" }],
  ADMIN: [
    { screen: "queue", label: "Ticket Queue" },
    { screen: "users", label: "User Management" },
  ],
};

const HOME_SCREEN: Record<UserRole, Screen> = {
  REQUESTER: "home",
  IT_STAFF: "queue",
  ADMIN: "queue",
};

const SESSION_EXPIRED =
  "Your session has expired. Please log in again.";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState("");
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedTicketId, setSelectedTicketId] =
    useState<number | null>(null);

  function showHome(current: AuthUser) {
    setSelectedTicketId(null);
    setScreen(HOME_SCREEN[current.role]);
  }

  async function restoreSession() {
    setLoading(true);
    setLoadError(false);

    try {
      const current = await getCurrentUser();

      if (current) {
        setUser(current);
        showHome(current);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // The Lab 2 Development Requester selector no longer exists.
    sessionStorage.removeItem("developmentRequesterId");

    void restoreSession();

    setUnauthorizedHandler(() => {
      setUser(null);
      setNotice(SESSION_EXPIRED);
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  function handleLoggedIn(current: AuthUser) {
    setNotice("");
    setUser(current);
    showHome(current);
  }

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setUser(null);
      setNotice("");
    }
  }

  function handleOpenTicket(ticket: TicketListItem) {
    setSelectedTicketId(ticket.id);
    setScreen("detail");
  }

  function handleOpenStaffTicket(ticket: StaffTicketListItem) {
    setSelectedTicketId(ticket.id);
    setScreen("staff-detail");
  }

  function go(next: Screen) {
    setSelectedTicketId(null);
    setScreen(next);
  }

  if (loading) {
    return (
      <main
        className="min-vh-100 d-flex align-items-center justify-content-center"
        style={{ backgroundColor: "#F5F7F6" }}
        aria-busy="true"
      >
        <div>
          <div
            className="spinner-border me-2"
            role="status"
            aria-hidden="true"
          />
          Loading...
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main
        className="min-vh-100 d-flex align-items-center justify-content-center"
        style={{ backgroundColor: "#F5F7F6" }}
      >
        <div className="text-center">
          <div className="alert alert-danger" role="alert">
            Unable to reach TokTickIT. Please try again.
          </div>
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={() => void restoreSession()}
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Login onLoggedIn={handleLoggedIn} notice={notice} />;
  }

  const mandatoryPasswordChange = user.mustChangePassword;
  const navigation = NAVIGATION[user.role];

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
          <div className="d-flex flex-wrap align-items-center gap-3">
            <strong className="fs-5 me-md-3">TokTickIT</strong>

            {!mandatoryPasswordChange && (
              <nav
                className="d-flex flex-wrap align-items-center gap-2"
                aria-label="Main"
              >
                {navigation.map((item) => {
                  const active =
                    screen === item.screen ||
                    (item.screen === "home" &&
                      screen === "detail") ||
                    (item.screen === "queue" &&
                      screen === "staff-detail");

                  return (
                    <button
                      key={item.screen}
                      type="button"
                      className={`btn btn-link text-white text-decoration-none px-3 py-2 ${
                        active
                          ? "fw-bold border-bottom border-3"
                          : ""
                      }`}
                      onClick={() => go(item.screen)}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            )}

            {/* Starts a new row on mobile. */}
            <div className="w-100 d-md-none" />

            <div className="d-flex flex-wrap align-items-center gap-2 gap-md-3 ms-md-auto">
              <span>{user.name}</span>
              <span className="badge bg-light text-success">
                {ROLE_LABELS[user.role]}
              </span>

              {!mandatoryPasswordChange && (
                <button
                  type="button"
                  className="btn btn-outline-light btn-sm"
                  onClick={() => go("change-password")}
                >
                  Change Password
                </button>
              )}

              <button
                type="button"
                className="btn btn-light btn-sm"
                onClick={() => void handleLogout()}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {mandatoryPasswordChange ? (
        <ChangePassword
          mandatory
          onChanged={(updated) => {
            setUser(updated);
            showHome(updated);
          }}
        />
      ) : (
        <>
          {screen === "change-password" && (
            <ChangePassword
              mandatory={false}
              onChanged={(updated) => {
                setUser(updated);
                showHome(updated);
              }}
              onCancel={() => showHome(user)}
            />
          )}

          {user.role === "REQUESTER" && (
            <>
              {screen === "home" && (
                <MyTickets
                  key={user.id}
                  onOpenTicket={handleOpenTicket}
                />
              )}

              {screen === "create" && (
                <CreateTicket
                  key={user.id}
                  requesterName={user.name}
                />
              )}

              {screen === "detail" &&
                selectedTicketId !== null && (
                  <TicketDetail
                    key={user.id}
                    ticketId={selectedTicketId}
                    requesterName={user.name}
                    onBack={() => go("home")}
                  />
                )}
            </>
          )}

          {user.role !== "REQUESTER" && (
            <>
              {screen === "queue" && (
                <StaffTicketQueue
                  key={user.id}
                  currentUserId={user.id}
                  onOpenTicket={handleOpenStaffTicket}
                />
              )}

              {screen === "staff-detail" && selectedTicketId !== null && (
                <StaffTicketDetail
                  key={selectedTicketId}
                  ticketId={selectedTicketId}
                  currentUser={user}
                  onBack={() => go("queue")}
                />
              )}

              {screen === "users" && user.role === "ADMIN" && (
                <UserManagement key={user.id} currentUserId={user.id} />
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
