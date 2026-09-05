import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";

void getPrisma;


export const app = express();

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "TokTickIT API",
  });
});

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
  } catch {
    res.status(500).json({
      error: "Unable to load categories",
    });
  }
});


app.get("/api/development-requesters", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const requesters = await prisma.requesterUser.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    res.status(200).json(requesters);
  } catch {
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Unable to load Development Requesters.",
      },
    });
  }
});

app.post("/api/tickets", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const {
      requesterId,
      categoryId,
      relatedSystemId,
      summary,
      description,
      requestedPriority,
    } = req.body;

    const fields: Record<string, string> = {};

    const trimmedSummary =
      typeof summary === "string" ? summary.trim() : "";

    const trimmedDescription =
      typeof description === "string" ? description.trim() : "";

    if (trimmedSummary.length < 5 || trimmedSummary.length > 120) {
      fields.summary = "Summary must be between 5 and 120 characters.";
    }

    if (
      trimmedDescription.length < 10 ||
      trimmedDescription.length > 4000
    ) {
      fields.description =
        "Description must be between 10 and 4000 characters.";
    }

    if (!["LOW", "MEDIUM", "HIGH"].includes(requestedPriority)) {
      fields.requestedPriority =
        "Requested Priority must be LOW, MEDIUM, or HIGH.";
    }

    if (!Number.isInteger(requesterId)) {
      fields.requesterId = "Requester is required.";
    }

    if (!Number.isInteger(categoryId)) {
      fields.categoryId = "Category is required.";
    }

    if (!Number.isInteger(relatedSystemId)) {
      fields.relatedSystemId = "Related System is required.";
    }

    if (Object.keys(fields).length > 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "The request contains invalid or missing data.",
          fields,
        },
      });
    }

    const requester = await prisma.requesterUser.findFirst({
      where: {
        id: requesterId,
        isActive: true,
      },
    });

    if (!requester) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Development Requester was not found.",
        },
      });
    }

    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
    });

    if (!category) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Category was not found.",
        },
      });
    }

    const relatedSystem = await prisma.relatedSystem.findFirst({
      where: {
        id: relatedSystemId,
        isActive: true,
      },
    });

    if (!relatedSystem) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Related System was not found.",
        },
      });
    }

    const latestTicket = await prisma.ticket.findFirst({
      orderBy: {
        id: "desc",
      },
      select: {
        id: true,
      },
    });

    const nextNumber = (latestTicket?.id ?? 0) + 1;
    const year = new Date().getFullYear();

    const ticketNumber = `TKT-${year}-${String(nextNumber).padStart(
      6,
      "0"
    )}`;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId,
        categoryId,
        relatedSystemId,
        summary: trimmedSummary,
        description: trimmedDescription,
        requestedPriority,
      },
    });

    return res.status(201).json(ticket);
  } catch {
    return res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Unable to create ticket.",
      },
    });
  }
});

app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const relatedSystems = await prisma.relatedSystem.findMany({
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
  } catch {
    return res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Unable to load Related Systems.",
      },
    });
  }
});