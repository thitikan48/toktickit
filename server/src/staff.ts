import { Request, Response, Router } from "express";
import { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { logServerError } from "./log.js";
import { requireRole } from "./auth.js";
import {
  canTransition,
  isTicketStatus,
  needsConfirmation,
} from "./rules.js";

const PAGE_SIZE = 10;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

const QUERY_KEYS = [
  "search",
  "status",
  "itPriority",
  "categoryId",
  "ownerId",
  "sort",
  "direction",
  "page",
];

function errorBody(
  code: string,
  message: string,
  fields?: Record<string, string>
) {
  return {
    error: fields
      ? { code, message, fields }
      : { code, message },
  };
}

const NOT_FOUND = errorBody("NOT_FOUND", "Ticket was not found.");

const SERVER_ERROR = errorBody(
  "SERVER_ERROR",
  "Something went wrong. Please try again."
);

function validation(fields: Record<string, string>) {
  return errorBody(
    "VALIDATION_ERROR",
    "The request contains invalid or missing data.",
    fields
  );
}

const userSummary = { select: { id: true, name: true } };

export const staffRouter = Router();

// Everything under /staff is for IT Staff and Administrators.
staffRouter.use("/staff", requireRole("IT_STAFF", "ADMIN"));

/*
 * Ticket Queue
 */
staffRouter.get(
  "/staff/tickets",
  async (req: Request, res: Response) => {
    try {
      const fields: Record<string, string> = {};
      const query = req.query;

      for (const key of Object.keys(query)) {
        if (!QUERY_KEYS.includes(key)) {
          fields[key] = "Unknown parameter.";
        }
      }

      const text = (key: string): string | undefined => {
        const value = query[key];
        return typeof value === "string" ? value : undefined;
      };

      const search = text("search")?.trim() ?? "";
      if (search.length > 100) {
        fields.search = "Search must be at most 100 characters.";
      }

      const status = text("status");
      if (status !== undefined && !isTicketStatus(status)) {
        fields.status = "Invalid status.";
      }

      const itPriority = text("itPriority");
      if (itPriority !== undefined && !PRIORITIES.includes(itPriority)) {
        fields.itPriority = "Invalid priority.";
      }

      const categoryIdText = text("categoryId");
      const categoryId =
        categoryIdText === undefined ? undefined : Number(categoryIdText);
      if (
        categoryId !== undefined &&
        (!Number.isInteger(categoryId) || categoryId < 1)
      ) {
        fields.categoryId = "Invalid category.";
      }

      const ownerText = text("ownerId");
      let ownerFilter: Prisma.TicketWhereInput = {};
      if (ownerText !== undefined) {
        if (ownerText === "unassigned") {
          ownerFilter = { ownerId: null };
        } else {
          const ownerId = Number(ownerText);
          if (!Number.isInteger(ownerId) || ownerId < 1) {
            fields.ownerId = "Invalid owner.";
          } else {
            ownerFilter = { ownerId };
          }
        }
      }

      const sort = text("sort");
      if (
        sort !== undefined &&
        !["createdAt", "updatedAt", "itPriority"].includes(sort)
      ) {
        fields.sort = "Invalid sort.";
      }

      const direction = text("direction");
      if (direction !== undefined && !["asc", "desc"].includes(direction)) {
        fields.direction = "Invalid direction.";
      }

      const pageText = text("page");
      const page = pageText === undefined ? 1 : Number(pageText);
      if (!Number.isInteger(page) || page < 1) {
        fields.page = "Page must be 1 or more.";
      }

      if (Object.keys(fields).length > 0) {
        return res.status(400).json(validation(fields));
      }

      const where: Prisma.TicketWhereInput = {
        ...ownerFilter,
        ...(status ? { currentStatus: status as never } : {}),
        ...(itPriority ? { itPriority: itPriority as never } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(search
          ? {
              OR: [
                { ticketNumber: { contains: search, mode: "insensitive" } },
                { summary: { contains: search, mode: "insensitive" } },
                {
                  requester: {
                    name: { contains: search, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      };

      // Default: highest IT Priority first, then the oldest ticket first.
      const dir = (direction as "asc" | "desc" | undefined) ?? "desc";
      const orderBy: Prisma.TicketOrderByWithRelationInput[] = sort
        ? [{ [sort]: dir }, { id: "asc" }]
        : [{ itPriority: "desc" }, { createdAt: "asc" }, { id: "asc" }];

      const prisma = getPrisma();

      const [items, totalItems] = await Promise.all([
        prisma.ticket.findMany({
          where,
          orderBy,
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: {
            id: true,
            ticketNumber: true,
            summary: true,
            requestedPriority: true,
            itPriority: true,
            currentStatus: true,
            requesterMarkedResolved: true,
            createdAt: true,
            updatedAt: true,
            category: userSummary,
            requester: userSummary,
            owner: userSummary,
          },
        }),
        prisma.ticket.count({ where }),
      ]);

      return res.status(200).json({
        items,
        page,
        pageSize: PAGE_SIZE,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / PAGE_SIZE),
      });
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);

/*
 * People a ticket can be assigned to
 */
staffRouter.get(
  "/staff/assignees",
  async (_req: Request, res: Response) => {
    try {
      const items = await getPrisma().user.findMany({
        where: {
          isActive: true,
          role: { in: ["IT_STAFF", "ADMIN"] },
        },
        select: { id: true, name: true, role: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });

      return res.status(200).json({ items });
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);

const detailSelect = {
  id: true,
  ticketNumber: true,
  summary: true,
  description: true,
  requestedPriority: true,
  itPriority: true,
  currentStatus: true,
  requesterMarkedResolved: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { id: true, name: true, email: true } },
  category: userSummary,
  relatedSystem: userSummary,
  owner: userSummary,
} satisfies Prisma.TicketSelect;

/*
 * One ticket for IT Staff
 */
staffRouter.get(
  "/staff/tickets/:id",
  async (req: Request, res: Response) => {
    try {
      const ticketId = Number(req.params.id);

      if (!Number.isInteger(ticketId)) {
        return res.status(404).json(NOT_FOUND);
      }

      const ticket = await getPrisma().ticket.findUnique({
        where: { id: ticketId },
        select: detailSelect,
      });

      if (!ticket) {
        return res.status(404).json(NOT_FOUND);
      }

      return res.status(200).json(ticket);
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);

/*
 * Owner and IT Priority. Claiming is assigning the ticket to yourself.
 */
staffRouter.patch(
  "/staff/tickets/:id",
  async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const fields: Record<string, string> = {};
      const data: Prisma.TicketUncheckedUpdateInput = {};

      const hasOwner = Object.prototype.hasOwnProperty.call(body, "ownerId");
      const hasPriority = Object.prototype.hasOwnProperty.call(body, "itPriority");

      if (!hasOwner && !hasPriority) {
        return res
          .status(400)
          .json(validation({ body: "Send ownerId and/or itPriority." }));
      }

      if (hasOwner && body.ownerId !== null && !Number.isInteger(body.ownerId)) {
        fields.ownerId = "Owner must be a user id or null.";
      }

      if (hasPriority) {
        if (!PRIORITIES.includes(body.itPriority)) {
          fields.itPriority = "Priority must be LOW, MEDIUM, or HIGH.";
        } else {
          data.itPriority = body.itPriority;
        }
      }

      if (Object.keys(fields).length > 0) {
        return res.status(400).json(validation(fields));
      }

      const ticketId = Number(req.params.id);
      const prisma = getPrisma();

      const exists = Number.isInteger(ticketId)
        ? await prisma.ticket.findUnique({
            where: { id: ticketId },
            select: { id: true },
          })
        : null;

      if (!exists) {
        return res.status(404).json(NOT_FOUND);
      }

      if (hasOwner) {
        if (body.ownerId === null) {
          data.ownerId = null;
        } else {
          const assignee = await prisma.user.findFirst({
            where: {
              id: body.ownerId,
              isActive: true,
              role: { in: ["IT_STAFF", "ADMIN"] },
            },
            select: { id: true },
          });

          if (!assignee) {
            return res
              .status(409)
              .json(
                errorBody(
                  "CONFLICT",
                  "The owner must be an active IT Staff or Administrator user."
                )
              );
          }

          data.ownerId = assignee.id;
        }
      }

      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data,
        select: {
          id: true,
          requestedPriority: true,
          itPriority: true,
          owner: userSummary,
          updatedAt: true,
        },
      });

      return res.status(200).json(updated);
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);

/*
 * Status workflow
 */
staffRouter.post(
  "/staff/tickets/:id/status",
  async (req: Request, res: Response) => {
    try {
      const { status, confirm } = req.body ?? {};

      if (!isTicketStatus(status)) {
        return res
          .status(400)
          .json(validation({ status: "Invalid status." }));
      }

      if (needsConfirmation(status) && confirm !== true) {
        return res
          .status(400)
          .json(validation({ confirm: "Confirm this status change." }));
      }

      const ticketId = Number(req.params.id);
      const prisma = getPrisma();

      const ticket = Number.isInteger(ticketId)
        ? await prisma.ticket.findUnique({
            where: { id: ticketId },
            select: { id: true, currentStatus: true, ownerId: true },
          })
        : null;

      if (!ticket) {
        return res.status(404).json(NOT_FOUND);
      }

      if (!canTransition(ticket.currentStatus, status)) {
        return res
          .status(409)
          .json(
            errorBody(
              "CONFLICT",
              "This status change is not allowed for the current status."
            )
          );
      }

      if (status !== "CANCELLED" && ticket.ownerId === null) {
        return res
          .status(409)
          .json(
            errorBody(
              "CONFLICT",
              "Assign an owner before changing the status."
            )
          );
      }

      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          currentStatus: status,
          // The Requester's "appears resolved" no longer applies after a reopen.
          ...(status === "REOPENED" ? { requesterMarkedResolved: false } : {}),
        },
        select: { id: true, currentStatus: true, updatedAt: true },
      });

      return res.status(200).json(updated);
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);
