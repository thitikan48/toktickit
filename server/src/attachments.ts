import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import {
  mkdir,
  readFile,
  writeFile,
} from "fs/promises";
import { getPrisma } from "./prisma.js";

const MAX_FILE_SIZE = 5_242_880;
const MAX_ACTIVE_ATTACHMENTS = 5;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(
        new Error(
          "UNSUPPORTED_MEDIA_TYPE"
        )
      );
      return;
    }

    callback(null, true);
  },
});

const uploadsDirectory =
  path.resolve(
    process.cwd(),
    "uploads"
  );

function validationError(
  message: string
) {
  return {
    error: {
      code: "VALIDATION_ERROR",
      message,
    },
  };
}

function forbiddenError() {
  return {
    error: {
      code: "FORBIDDEN",
      message:
        "You are not authorized to access this resource.",
    },
  };
}

function notFoundError(
  message: string
) {
  return {
    error: {
      code: "NOT_FOUND",
      message,
    },
  };
}

export const attachmentRouter =
  Router();

/*
 * Get attachment metadata for an owned Ticket.
 */
attachmentRouter.get(
  "/tickets/:id/attachments",
  async (req, res) => {
    try {
      const prisma =
        getPrisma();

      const ticketId =
        Number(req.params.id);

      const requesterId =
        Number(
          req.query.requesterId
        );

      if (
        !Number.isInteger(ticketId) ||
        !Number.isInteger(requesterId)
      ) {
        return res
          .status(400)
          .json(
            validationError(
              "Ticket ID and Requester are required."
            )
          );
      }

      const ticket =
        await prisma.ticket.findUnique({
          where: {
            id: ticketId,
          },

          select: {
            id: true,
            requesterId: true,
          },
        });

      if (!ticket) {
        return res
          .status(404)
          .json(
            notFoundError(
              "Ticket was not found."
            )
          );
      }

      if (
        ticket.requesterId !==
        requesterId
      ) {
        return res
          .status(403)
          .json(
            forbiddenError()
          );
      }

      const attachments =
        await prisma.attachment.findMany({
          where: {
            ticketId,
          },

          select: {
            id: true,
            ticketId: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            isRemoved: true,
            removalReason: true,
            removedAt: true,
            createdAt: true,
          },

          orderBy: {
            createdAt: "asc",
          },
        });

      return res
        .status(200)
        .json(attachments);
    } catch {
      return res
        .status(500)
        .json({
          error: {
            code: "SERVER_ERROR",
            message:
              "Unable to load attachments.",
          },
        });
    }
  }
);

/*
 * Add an attachment to an owned Ticket.
 */
attachmentRouter.post(
  "/tickets/:id/attachments",

  (req, res, next) => {
    upload.single("file")(
      req,
      res,
      (error) => {
        if (!error) {
          next();
          return;
        }

        if (
          error instanceof
            multer.MulterError &&
          error.code ===
            "LIMIT_FILE_SIZE"
        ) {
          res.status(413).json({
            error: {
              code:
                "PAYLOAD_TOO_LARGE",
              message:
                "Attachment must not exceed 5 MB.",
            },
          });

          return;
        }

        if (
          error instanceof Error &&
          error.message ===
            "UNSUPPORTED_MEDIA_TYPE"
        ) {
          res.status(415).json({
            error: {
              code:
                "UNSUPPORTED_MEDIA_TYPE",
              message:
                "Only JPG, PNG, WEBP, and PDF files are allowed.",
            },
          });

          return;
        }

        res.status(400).json(
          validationError(
            "Unable to process attachment upload."
          )
        );
      }
    );
  },

  async (req, res) => {
    try {
      const prisma =
        getPrisma();

      const ticketId =
        Number(req.params.id);

      const requesterId =
        Number(
          req.body.requesterId
        );

      if (
        !Number.isInteger(ticketId) ||
        !Number.isInteger(requesterId)
      ) {
        return res
          .status(400)
          .json(
            validationError(
              "Ticket ID and Requester are required."
            )
          );
      }

      if (!req.file) {
        return res
          .status(400)
          .json(
            validationError(
              "Attachment file is required."
            )
          );
      }

      const ticket =
        await prisma.ticket.findUnique({
          where: {
            id: ticketId,
          },

          select: {
            id: true,
            requesterId: true,
          },
        });

      if (!ticket) {
        return res
          .status(404)
          .json(
            notFoundError(
              "Ticket was not found."
            )
          );
      }

      if (
        ticket.requesterId !==
        requesterId
      ) {
        return res
          .status(403)
          .json(
            forbiddenError()
          );
      }

      const activeCount =
        await prisma.attachment.count({
          where: {
            ticketId,
            isRemoved: false,
          },
        });

      if (
        activeCount >=
        MAX_ACTIVE_ATTACHMENTS
      ) {
        return res
          .status(400)
          .json(
            validationError(
              "Maximum active attachments (5/5) reached."
            )
          );
      }

      const extension =
        path
          .extname(
            req.file.originalname
          )
          .toLowerCase();

      const storedName =
        `${randomUUID()}${extension}`;

      await mkdir(
        uploadsDirectory,
        {
          recursive: true,
        }
      );

      await writeFile(
        path.join(
          uploadsDirectory,
          storedName
        ),
        req.file.buffer
      );

      const attachment =
        await prisma.attachment.create({
          data: {
            ticketId,

            originalName:
              req.file.originalname,

            storedName,

            mimeType:
              req.file.mimetype,

            sizeBytes:
              req.file.size,
          },

          select: {
            id: true,
            ticketId: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            isRemoved: true,
            removalReason: true,
            removedAt: true,
            createdAt: true,
          },
        });

      return res
        .status(201)
        .json(attachment);
    } catch {
      return res
        .status(500)
        .json({
          error: {
            code: "SERVER_ERROR",
            message:
              "Unable to upload attachment.",
          },
        });
    }
  }
);

/*
 * Download an active attachment.
 */
attachmentRouter.get(
  "/attachments/:id/download",
  async (req, res) => {
    try {
      const prisma =
        getPrisma();

      const attachmentId =
        Number(req.params.id);

      const requesterId =
        Number(
          req.query.requesterId
        );

      if (
        !Number.isInteger(
          attachmentId
        ) ||
        !Number.isInteger(
          requesterId
        )
      ) {
        return res
          .status(400)
          .json(
            validationError(
              "Attachment ID and Requester are required."
            )
          );
      }

      const attachment =
        await prisma.attachment.findUnique({
          where: {
            id: attachmentId,
          },

          include: {
            ticket: {
              select: {
                requesterId: true,
              },
            },
          },
        });

      if (!attachment) {
        return res
          .status(404)
          .json(
            notFoundError(
              "Attachment was not found."
            )
          );
      }

      if (
        attachment.ticket
          .requesterId !==
        requesterId
      ) {
        return res
          .status(403)
          .json(
            forbiddenError()
          );
      }

      if (
        attachment.isRemoved
      ) {
        return res
          .status(410)
          .json({
            error: {
              code: "GONE",
              message:
                "This attachment has been removed and is no longer available.",
            },
          });
      }

      const filePath =
        path.join(
          uploadsDirectory,
          attachment.storedName
        );

      const file =
        await readFile(
          filePath
        );

      const encodedName =
        encodeURIComponent(
          attachment.originalName
        );

      res.setHeader(
        "Content-Type",
        attachment.mimeType
      );

      res.setHeader(
        "Content-Length",
        String(
          attachment.sizeBytes
        )
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodedName}`
      );

      return res
        .status(200)
        .send(file);
    } catch {
      return res
        .status(500)
        .json({
          error: {
            code: "SERVER_ERROR",
            message:
              "Unable to download attachment.",
          },
        });
    }
  }
);

/*
 * Soft-remove an attachment.
 *
 * Lab Sheet requires soft removal with a reason.
 * Keep the rule simple:
 * the reason is required and must not be empty
 * after trimming whitespace.
 */
attachmentRouter.delete(
  "/attachments/:id",
  async (req, res) => {
    try {
      const prisma =
        getPrisma();

      const attachmentId =
        Number(req.params.id);

      const requesterId =
        Number(
          req.body.requesterId
        );

      const removalReason =
        typeof req.body
          .removalReason ===
        "string"
          ? req.body.removalReason.trim()
          : "";

      if (
        !Number.isInteger(
          attachmentId
        ) ||
        !Number.isInteger(
          requesterId
        )
      ) {
        return res
          .status(400)
          .json(
            validationError(
              "Attachment ID and Requester are required."
            )
          );
      }

      const attachment =
        await prisma.attachment.findUnique({
          where: {
            id: attachmentId,
          },

          include: {
            ticket: {
              select: {
                requesterId: true,
              },
            },
          },
        });

      if (!attachment) {
        return res
          .status(404)
          .json(
            notFoundError(
              "Attachment was not found."
            )
          );
      }

      if (
        attachment.ticket
          .requesterId !==
        requesterId
      ) {
        return res
          .status(403)
          .json(
            forbiddenError()
          );
      }

      if (
        attachment.isRemoved
      ) {
        return res
          .status(409)
          .json({
            error: {
              code: "CONFLICT",
              message:
                "Attachment has already been removed.",
            },
          });
      }

      if (!removalReason) {
        return res
          .status(400)
          .json(
            validationError(
              "Removal reason is required."
            )
          );
      }

      const removedAttachment =
        await prisma.attachment.update({
          where: {
            id: attachmentId,
          },

          data: {
            isRemoved: true,
            removalReason,
            removedAt: new Date(),
          },

          select: {
            id: true,
            ticketId: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            isRemoved: true,
            removalReason: true,
            removedAt: true,
            createdAt: true,
          },
        });

      return res
        .status(200)
        .json(
          removedAttachment
        );
    } catch {
      return res
        .status(500)
        .json({
          error: {
            code: "SERVER_ERROR",
            message:
              "Unable to remove attachment.",
          },
        });
    }
  }
);