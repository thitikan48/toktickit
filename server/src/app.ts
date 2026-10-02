import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { logServerError } from "./log.js";
import { attachmentRouter } from "./attachments.js";
import { commentRouter } from "./comments.js";
import { staffRouter } from "./staff.js";
import { adminRouter } from "./admin.js";
import { generateTicketNumber } from "./ticket-number.js";
import {
  authRouter,
  loadUser,
  requireAuth,
  requireRole,
  sessionMiddleware,
} from "./auth.js";

void getPrisma;

export const app = express();

app.use(
  cors({
    origin:
      process.env.CLIENT_ORIGIN ??
      "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(sessionMiddleware);
app.use(loadUser);

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "TokTickIT API",
  });
});

// Login, logout, current user, and change password.
app.use("/api/auth", authRouter);

// Every other endpoint requires a logged-in user.
app.use("/api", requireAuth);

app.use("/api", attachmentRouter);
app.use("/api", commentRouter);
app.use("/api", staffRouter);
app.use("/api", adminRouter);

app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    res.status(200).json(categories);
  } catch (error) {
      logServerError(error);
    res.status(500).json({
      error: "Unable to load categories",
    });
  }
});

app.get(
  "/api/related-systems",
  async (_req: Request, res: Response) => {
    try {
      const prisma = getPrisma();

      const relatedSystems =
        await prisma.relatedSystem.findMany({
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            id: "asc",
          },
        });

      return res.status(200).json(relatedSystems);
    } catch (error) {
      logServerError(error);
      return res.status(500).json({
        error: {
          code: "SERVER_ERROR",
          message:
            "Unable to load Related Systems.",
        },
      });
    }
  }
);

/*
 * My Tickets
 */
app.get(
  "/api/tickets",
  requireRole("REQUESTER"),
  async (req: Request, res: Response) => {
    try {
      const prisma = getPrisma();

      const requesterId = req.user!.id;

      const search =
        typeof req.query.search === "string"
          ? req.query.search.trim()
          : "";

      const status =
        typeof req.query.status === "string"
          ? req.query.status
          : "";

      const categoryId =
        typeof req.query.categoryId === "string"
          ? Number(req.query.categoryId)
          : undefined;

      const requestedPriority =
        typeof req.query.requestedPriority === "string"
          ? req.query.requestedPriority
          : "";

      const sort =
        typeof req.query.sort === "string"
          ? req.query.sort
          : "createdAt_desc";

      const page =
        typeof req.query.page === "string"
          ? Math.max(
              1,
              Number(req.query.page)
            )
          : 1;

      const pageSize =
        typeof req.query.pageSize === "string"
          ? Math.max(
              1,
              Number(req.query.pageSize)
            )
          : 10;



      const where = {
        requesterId,

        ...(search
          ? {
              OR: [
                {
                  ticketNumber: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  summary: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),

        ...(status
          ? {
              currentStatus:
                status as "NEW",
            }
          : {}),

        ...(Number.isInteger(categoryId)
          ? {
              categoryId,
            }
          : {}),

        ...(requestedPriority
          ? {
              requestedPriority:
                requestedPriority as
                  | "LOW"
                  | "MEDIUM"
                  | "HIGH",
            }
          : {}),
      };

      const [items, totalItems] =
        await Promise.all([
          prisma.ticket.findMany({
            where,

            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },

              owner: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },

            orderBy:
              sort === "createdAt_asc"
                ? {
                    createdAt: "asc",
                  }
                : {
                    createdAt: "desc",
                  },

            skip:
              (page - 1) * pageSize,

            take: pageSize,
          }),

          prisma.ticket.count({
            where,
          }),
        ]);

      const totalPages =
        totalItems === 0
          ? 0
          : Math.ceil(
              totalItems / pageSize
            );

      return res.status(200).json({
        items,
        page,
        pageSize,
        totalItems,
        totalPages,
      });
    } catch (error) {
      logServerError(error);
      return res.status(500).json({
        error: {
          code: "SERVER_ERROR",
          message:
            "Unable to load tickets.",
        },
      });
    }
  }
);

/*
 * Requester Ticket Detail
 */
app.get(
  "/api/tickets/:id",
  requireRole("REQUESTER"),
  async (req: Request, res: Response) => {
    try {
      const prisma = getPrisma();

      const ticketId = Number(
        req.params.id
      );

      const requesterId = req.user!.id;

      if (
        !Number.isInteger(ticketId)
      ) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Ticket ID is required.",
          },
        });
      }


      const ticket =
        await prisma.ticket.findUnique({
          where: {
            id: ticketId,
          },

          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },

            relatedSystem: {
              select: {
                id: true,
                name: true,
              },
            },

            owner: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

      // Another Requester's ticket gets the same answer as a missing one,
      // so its existence is not revealed.
      if (
        !ticket ||
        ticket.requesterId !== requesterId
      ) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message:
              "Ticket was not found.",
          },
        });
      }

      return res
        .status(200)
        .json(ticket);
    } catch (error) {
      logServerError(error);
      return res.status(500).json({
        error: {
          code: "SERVER_ERROR",
          message:
            "Unable to load ticket.",
        },
      });
    }
  }
);

/*
 * Create Ticket
 */
app.post(
  "/api/tickets",
  requireRole("REQUESTER"),
  async (req: Request, res: Response) => {
    try {
      const prisma = getPrisma();

      const requesterId = req.user!.id;

      const {
        categoryId,
        relatedSystemId,
        summary,
        description,
        requestedPriority,
      } = req.body;

      const fields: Record<
        string,
        string
      > = {};

      const trimmedSummary =
        typeof summary === "string"
          ? summary.trim()
          : "";

      const trimmedDescription =
        typeof description === "string"
          ? description.trim()
          : "";

      if (
        trimmedSummary.length < 5 ||
        trimmedSummary.length > 120
      ) {
        fields.summary =
          "Summary must be between 5 and 120 characters.";
      }

      if (
        trimmedDescription.length < 10 ||
        trimmedDescription.length > 4000
      ) {
        fields.description =
          "Description must be between 10 and 4000 characters.";
      }

      if (
        ![
          "LOW",
          "MEDIUM",
          "HIGH",
        ].includes(
          requestedPriority
        )
      ) {
        fields.requestedPriority =
          "Requested Priority must be LOW, MEDIUM, or HIGH.";
      }


      if (
        !Number.isInteger(
          categoryId
        )
      ) {
        fields.categoryId =
          "Category is required.";
      }

      if (
        !Number.isInteger(
          relatedSystemId
        )
      ) {
        fields.relatedSystemId =
          "Related System is required.";
      }

      if (
        Object.keys(fields).length >
        0
      ) {
        return res.status(400).json({
          error: {
            code:
              "VALIDATION_ERROR",
            message:
              "The request contains invalid or missing data.",
            fields,
          },
        });
      }


      const category =
        await prisma.category.findUnique({
          where: {
            id: categoryId,
          },
        });

      if (!category) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message:
              "Category was not found.",
          },
        });
      }

      const relatedSystem =
        await prisma.relatedSystem.findFirst({
          where: {
            id: relatedSystemId,
            isActive: true,
          },
        });

      if (!relatedSystem) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message:
              "Related System was not found.",
          },
        });
      }

      const latestTicket =
        await prisma.ticket.findFirst({
          orderBy: {
            id: "desc",
          },
          select: {
            id: true,
          },
        });

      const nextNumber =
        (latestTicket?.id ?? 0) +
        1;

      const year =
        new Date().getFullYear();

      const ticketNumber =
        generateTicketNumber(year, nextNumber);

      const ticket =
        await prisma.ticket.create({
          data: {
            ticketNumber,
            requesterId,
            categoryId,
            relatedSystemId,
            summary:
              trimmedSummary,
            description:
              trimmedDescription,
            requestedPriority,
            itPriority: requestedPriority,
          },
        });

      return res
        .status(201)
        .json(ticket);
    } catch (error) {
      logServerError(error);
      return res.status(500).json({
        error: {
          code: "SERVER_ERROR",
          message:
            "Unable to create ticket.",
        },
      });
    }
  }
);