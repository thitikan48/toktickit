import { Request, Response, Router } from "express";
import { TicketStatus } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { logServerError } from "./log.js";
import { requireRole } from "./auth.js";
import { TICKET_STATUSES } from "./rules.js";

// Dashboard rules: docs/lab-04/specification.md section 5.5 and
// api-spec.md section 8. Times are stored in UTC; the UI shows Bangkok time.

export const ACTIVE_STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
];

const OPEN_ACTION_STATUSES = ["PLANNED", "IN_PROGRESS"] as const;
const RECENT_DAYS = 7;
const LIST_SIZE = 5;

// "Recent" is from now minus 7 days up to now.
export function recentSince(now: Date): Date {
  return new Date(now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000);
}

export function isRecent(value: Date, now: Date): boolean {
  return value >= recentSince(now) && value <= now;
}

const SERVER_ERROR = {
  error: { code: "SERVER_ERROR", message: "Something went wrong. Please try again." },
};

const ticketSummary = {
  id: true,
  ticketNumber: true,
  summary: true,
  currentStatus: true,
} as const;

export const dashboardRouter = Router();

/*
 * Requester Dashboard: only the session user's Tickets. A requesterId
 * parameter is ignored (BR-20).
 */
dashboardRouter.get(
  "/dashboard/requester",
  requireRole("REQUESTER"),
  async (req: Request, res: Response) => {
    try {
      const prisma = getPrisma();
      const requesterId = req.user!.id;
      const since = recentSince(new Date());

      const [openTickets, waitingForMe, recentlyUpdated, recentlyResolved] =
        await Promise.all([
          prisma.ticket.count({
            where: { requesterId, currentStatus: { in: ACTIVE_STATUSES } },
          }),
          prisma.ticket.count({
            where: { requesterId, currentStatus: "WAITING_FOR_REQUESTER" },
          }),
          prisma.ticket.findMany({
            where: { requesterId, updatedAt: { gte: since } },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: LIST_SIZE,
            select: { ...ticketSummary, updatedAt: true },
          }),
          prisma.ticket.findMany({
            where: { requesterId, resolvedAt: { gte: since } },
            orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
            take: LIST_SIZE,
            select: { ...ticketSummary, resolvedAt: true },
          }),
        ]);

      return res
        .status(200)
        .json({ openTickets, waitingForMe, recentlyUpdated, recentlyResolved });
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);

/*
 * IT Staff Dashboard, also used by Administrators (BR-21). Counts and short
 * lists only, never full Ticket collections (BR-22).
 */
dashboardRouter.get(
  "/staff/dashboard",
  requireRole("IT_STAFF", "ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const prisma = getPrisma();
      const me = req.user!.id;
      const since = recentSince(new Date());
      const myOpenAction = {
        assignedToId: me,
        status: { in: [...OPEN_ACTION_STATUSES] },
      };

      const [unassigned, myOpenTickets, myOpenActions, actions, groups, recentlyUpdated] =
        await Promise.all([
          prisma.ticket.count({
            where: { ownerId: null, currentStatus: { in: ACTIVE_STATUSES } },
          }),
          prisma.ticket.count({
            where: { ownerId: me, currentStatus: { in: ACTIVE_STATUSES } },
          }),
          prisma.actionTaken.count({ where: myOpenAction }),
          // Oldest Action Date/Time first.
          prisma.actionTaken.findMany({
            where: myOpenAction,
            orderBy: [{ actionAt: "asc" }, { id: "asc" }],
            take: LIST_SIZE,
            select: {
              id: true,
              ticketId: true,
              description: true,
              status: true,
              actionAt: true,
              ticket: { select: { ticketNumber: true } },
            },
          }),
          prisma.ticket.groupBy({ by: ["currentStatus"], _count: true }),
          prisma.ticket.findMany({
            where: { updatedAt: { gte: since } },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: LIST_SIZE,
            select: {
              ...ticketSummary,
              owner: { select: { id: true, name: true } },
              updatedAt: true,
            },
          }),
        ]);

      // All 8 statuses, with 0 for the missing ones.
      const countsByStatus = Object.fromEntries(
        TICKET_STATUSES.map((status) => [
          status,
          groups.find((group) => group.currentStatus === status)?._count ?? 0,
        ])
      );

      const myOpenActionsList = actions.map((action) => ({
        actionId: action.id,
        ticketId: action.ticketId,
        ticketNumber: action.ticket.ticketNumber,
        description: action.description,
        status: action.status,
        actionAt: action.actionAt,
      }));

      return res.status(200).json({
        unassigned,
        myOpenTickets,
        myOpenActions,
        myOpenActionsList,
        countsByStatus,
        recentlyUpdated,
      });
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);
