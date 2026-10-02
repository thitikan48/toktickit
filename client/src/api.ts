const API_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000";

/*
 * Every request sends the session cookie. A 401 on a protected request
 * (the session expired or the user was deactivated) is reported once so the
 * app can return to the Login screen.
 */
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(
  handler: (() => void) | null
) {
  unauthorizedHandler = handler;
}

async function apiFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
  });

  if (
    response.status === 401 &&
    !url.includes("/api/auth/")
  ) {
    unauthorizedHandler?.();
  }

  return response;
}

export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string> = {}
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function readError(
  response: Response,
  fallback: string
): Promise<ApiError> {
  const body = await response
    .json()
    .catch(() => null);

  return new ApiError(
    response.status,
    body?.error?.code ?? "SERVER_ERROR",
    body?.error?.message ?? fallback,
    body?.error?.fields ?? {}
  );
}

export type UserRole =
  | "REQUESTER"
  | "IT_STAFF"
  | "ADMIN";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export async function login(
  email: string,
  password: string
): Promise<AuthUser> {
  const response = await apiFetch(
    `${API_URL}/api/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    }
  );

  if (!response.ok) {
    throw await readError(
      response,
      "Unable to log in"
    );
  }

  return (await response.json()).user;
}

export async function logout(): Promise<void> {
  await apiFetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
  });
}

/** Returns the logged-in user, or null when there is no session. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await apiFetch(
    `${API_URL}/api/auth/me`
  );

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw await readError(
      response,
      "Unable to load the current user"
    );
  }

  return (await response.json()).user;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<AuthUser> {
  const response = await apiFetch(
    `${API_URL}/api/auth/change-password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    }
  );

  if (!response.ok) {
    throw await readError(
      response,
      "Unable to change the password"
    );
  }

  return (await response.json()).user;
}

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export async function checkSystem(): Promise<SystemStatus> {
  const healthResponse = await apiFetch(
    `${API_URL}/api/health`
  );

  if (!healthResponse.ok) {
    throw new Error(
      "Unable to connect to TokTickIT API"
    );
  }

  await healthResponse.json();

  const categoriesResponse = await apiFetch(
    `${API_URL}/api/categories`
  );

  if (!categoriesResponse.ok) {
    throw new Error(
      "Unable to load categories"
    );
  }

  const categories: Category[] =
    await categoriesResponse.json();

  return {
    online: true,
    categories,
  };
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export async function getCategories(): Promise<
  Category[]
> {
  const response = await apiFetch(
    `${API_URL}/api/categories`
  );

  if (!response.ok) {
    throw new Error(
      "Unable to load categories"
    );
  }

  return response.json();
}

export async function getRelatedSystems(): Promise<
  RelatedSystem[]
> {
  const response = await apiFetch(
    `${API_URL}/api/related-systems`
  );

  if (!response.ok) {
    throw new Error(
      "Unable to load related systems"
    );
  }

  return response.json();
}

export type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

export type RequestedPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export interface CreateTicketInput {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
}

export interface CreatedTicket {
  id: number;
  ticketNumber: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
  currentStatus: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export async function createTicket(
  input: CreateTicketInput
): Promise<CreatedTicket> {
  const response = await apiFetch(
    `${API_URL}/api/tickets`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Unable to create ticket"
    );
  }

  return response.json();
}

export interface TicketListItem {
  id: number;
  ticketNumber: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  currentStatus: TicketStatus;
  requesterMarkedResolved: boolean;
  createdAt: string;
  updatedAt: string;

  owner: {
    id: number;
    name: string;
  } | null;

  category: {
    id: number;
    name: string;
  };
}

/*
 * Issue 5: Requester Ticket Detail
 */
export interface TicketDetail
  extends TicketListItem {
  relatedSystem: {
    id: number;
    name: string;
  };
}

export interface TicketListResponse {
  items: TicketListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface GetTicketsParams {
  search?: string;
  status?: string;
  categoryId?: number;
  requestedPriority?: RequestedPriority;
  sort?:
    | "createdAt_asc"
    | "createdAt_desc";
  page?: number;
  pageSize?: number;
}

export async function getTickets(
  params: GetTicketsParams
): Promise<TicketListResponse> {
  const query = new URLSearchParams();

  if (params.search) {
    query.set(
      "search",
      params.search
    );
  }

  if (params.status) {
    query.set(
      "status",
      params.status
    );
  }

  if (params.categoryId) {
    query.set(
      "categoryId",
      String(params.categoryId)
    );
  }

  if (params.requestedPriority) {
    query.set(
      "requestedPriority",
      params.requestedPriority
    );
  }

  if (params.sort) {
    query.set(
      "sort",
      params.sort
    );
  }

  if (params.page) {
    query.set(
      "page",
      String(params.page)
    );
  }

  if (params.pageSize) {
    query.set(
      "pageSize",
      String(params.pageSize)
    );
  }

  const response = await apiFetch(
    `${API_URL}/api/tickets?${query.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      "Unable to load tickets"
    );
  }

  return response.json();
}

/*
 * Issue 5: Load one owned Ticket
 */
export async function getTicketById(
  ticketId: number
): Promise<TicketDetail> {
  const response = await apiFetch(
    `${API_URL}/api/tickets/${ticketId}`
  );

  if (!response.ok) {
    throw new Error(
      "Unable to load ticket"
    );
  }

  return response.json();
}

export interface Attachment {
  id: number;
  ticketId: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  isRemoved: boolean;
  removalReason:
    | string
    | null;
  removedAt:
    | string
    | null;
  createdAt: string;
}

export async function getAttachments(
  ticketId: number
): Promise<Attachment[]> {
  const response =
    await apiFetch(
      `${API_URL}/api/tickets/${ticketId}/attachments`
    );

  if (!response.ok) {
    throw new Error(
      "Unable to load attachments"
    );
  }

  return response.json();
}

export async function uploadAttachment(
  ticketId: number,
  file: File
): Promise<Attachment> {
  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );

  const response =
    await apiFetch(
      `${API_URL}/api/tickets/${ticketId}/attachments`,
      {
        method: "POST",
        body: formData,
      }
    );

  if (!response.ok) {
    const body =
      await response
        .json()
        .catch(() => null);

    throw new Error(
      body?.error?.message ||
        "Unable to upload attachment"
    );
  }

  return response.json();
}

export async function removeAttachment(
  attachmentId: number,
  removalReason: string
): Promise<Attachment> {
  const response =
    await apiFetch(
      `${API_URL}/api/attachments/${attachmentId}`,
      {
        method: "DELETE",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          removalReason,
        }),
      }
    );

  if (!response.ok) {
    const body =
      await response
        .json()
        .catch(() => null);

    throw new Error(
      body?.error?.message ||
        "Unable to remove attachment"
    );
  }

  return response.json();
}

export function getAttachmentDownloadUrl(
  attachmentId: number
) {
  return `${API_URL}/api/attachments/${attachmentId}/download`;
}

/*
 * Public Comments and "Problem Appears Resolved"
 */
export interface TicketComment {
  id: number;
  body: string;
  createdAt: string;
  author: {
    id: number;
    name: string;
    role: UserRole;
  };
}

export async function getComments(
  ticketId: number
): Promise<TicketComment[]> {
  const response = await apiFetch(
    `${API_URL}/api/tickets/${ticketId}/comments`
  );

  if (!response.ok) {
    throw await readError(
      response,
      "Unable to load comments"
    );
  }

  return (await response.json()).items;
}

export async function postComment(
  ticketId: number,
  body: string
): Promise<TicketComment> {
  const response = await apiFetch(
    `${API_URL}/api/tickets/${ticketId}/comments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    }
  );

  if (!response.ok) {
    throw await readError(
      response,
      "Unable to post the comment"
    );
  }

  return response.json();
}

export async function markAppearsResolved(
  ticketId: number
): Promise<void> {
  const response = await apiFetch(
    `${API_URL}/api/tickets/${ticketId}/appears-resolved`,
    { method: "POST" }
  );

  if (!response.ok) {
    throw await readError(
      response,
      "Unable to send your update"
    );
  }
}
