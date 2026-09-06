const API_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export async function checkSystem(): Promise<SystemStatus> {
  const healthResponse = await fetch(
    `${API_URL}/api/health`
  );

  if (!healthResponse.ok) {
    throw new Error(
      "Unable to connect to TokTickIT API"
    );
  }

  await healthResponse.json();

  const categoriesResponse = await fetch(
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

export interface DevelopmentRequester {
  id: number;
  name: string;
  email: string;
}

export async function getDevelopmentRequesters(): Promise<
  DevelopmentRequester[]
> {
  const response = await fetch(
    `${API_URL}/api/development-requesters`
  );

  if (!response.ok) {
    throw new Error(
      "Unable to load Development Requesters"
    );
  }

  return response.json();
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export async function getCategories(): Promise<
  Category[]
> {
  const response = await fetch(
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
  const response = await fetch(
    `${API_URL}/api/related-systems`
  );

  if (!response.ok) {
    throw new Error(
      "Unable to load related systems"
    );
  }

  return response.json();
}

export type RequestedPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export interface CreateTicketInput {
  requesterId: number;
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
  currentStatus: "NEW";
  createdAt: string;
  updatedAt: string;
}

export async function createTicket(
  input: CreateTicketInput
): Promise<CreatedTicket> {
  const response = await fetch(
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
  currentStatus: "NEW";
  createdAt: string;
  updatedAt: string;

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
  requesterId: number;
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

  query.set(
    "requesterId",
    String(params.requesterId)
  );

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

  const response = await fetch(
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
  ticketId: number,
  requesterId: number
): Promise<TicketDetail> {
  const query = new URLSearchParams();

  query.set(
    "requesterId",
    String(requesterId)
  );

  const response = await fetch(
    `${API_URL}/api/tickets/${ticketId}?${query.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      "Unable to load ticket"
    );
  }

  return response.json();
}