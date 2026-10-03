import { Request, Response, Router } from "express";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { logServerError } from "./log.js";
import { requireRole } from "./auth.js";
import { validateNewPassword } from "./rules.js";

const BCRYPT_COST = 12;
const ROLES = ["REQUESTER", "IT_STAFF", "ADMIN"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const NOT_FOUND = errorBody("NOT_FOUND", "User was not found.");

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

// Never includes the password hash.
const publicUser = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
} satisfies Prisma.UserSelect;

/** Returns the cleaned value, or an error message. */
function cleanName(value: unknown): { value?: string; error?: string } {
  const name = typeof value === "string" ? value.trim() : "";

  return name.length >= 2 && name.length <= 100
    ? { value: name }
    : { error: "Name must be between 2 and 100 characters." };
}

function cleanEmail(value: unknown): { value?: string; error?: string } {
  const email =
    typeof value === "string" ? value.trim().toLowerCase() : "";

  return email.length <= 254 && EMAIL_PATTERN.test(email)
    ? { value: email }
    : { error: "Enter a valid email address." };
}

export const adminRouter = Router();

// User management is for Administrators only. There is no delete endpoint:
// accounts are deactivated, never deleted.
adminRouter.use("/admin", requireRole("ADMIN"));

adminRouter.get(
  "/admin/users",
  async (req: Request, res: Response) => {
    try {
      const fields: Record<string, string> = {};

      for (const key of Object.keys(req.query)) {
        if (key !== "search" && key !== "role") {
          fields[key] = "Unknown parameter.";
        }
      }

      const search =
        typeof req.query.search === "string"
          ? req.query.search.trim()
          : "";
      if (search.length > 100) {
        fields.search = "Search must be at most 100 characters.";
      }

      const role =
        typeof req.query.role === "string" ? req.query.role : undefined;
      if (role !== undefined && !ROLES.includes(role)) {
        fields.role = "Invalid role.";
      }

      if (Object.keys(fields).length > 0) {
        return res.status(400).json(validation(fields));
      }

      const items = await getPrisma().user.findMany({
        where: {
          ...(role ? { role: role as never } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: publicUser,
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });

      return res.status(200).json({ items });
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);

adminRouter.post(
  "/admin/users",
  async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const fields: Record<string, string> = {};

      const name = cleanName(body.name);
      if (name.error) fields.name = name.error;

      const email = cleanEmail(body.email);
      if (email.error) fields.email = email.error;

      if (!ROLES.includes(body.role)) {
        fields.role = "Choose a role.";
      }

      if (
        body.isActive !== undefined &&
        typeof body.isActive !== "boolean"
      ) {
        fields.isActive = "Active must be true or false.";
      }

      const passwordProblem = validateNewPassword(body.initialPassword);
      if (passwordProblem) fields.initialPassword = passwordProblem;

      if (Object.keys(fields).length > 0) {
        return res.status(400).json(validation(fields));
      }

      const prisma = getPrisma();

      const taken = await prisma.user.findUnique({
        where: { email: email.value! },
        select: { id: true },
      });

      if (taken) {
        return res
          .status(409)
          .json(
            errorBody("CONFLICT", "This email is already in use.", {
              email: "This email is already in use.",
            })
          );
      }

      // The user must choose their own password at first login.
      const user = await prisma.user.create({
        data: {
          name: name.value!,
          email: email.value!,
          role: body.role,
          isActive: body.isActive ?? true,
          passwordHash: await bcrypt.hash(
            body.initialPassword,
            BCRYPT_COST
          ),
          mustChangePassword: true,
        },
        select: publicUser,
      });

      return res.status(201).json(user);
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);

adminRouter.patch(
  "/admin/users/:id",
  async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const fields: Record<string, string> = {};
      const data: Prisma.UserUpdateInput = {};

      const allowed = ["name", "email", "role", "isActive"];
      const keys = Object.keys(body);

      if (keys.length === 0) {
        return res
          .status(400)
          .json(validation({ body: "Send at least one field to change." }));
      }

      for (const key of keys) {
        if (!allowed.includes(key)) fields[key] = "This field cannot be changed.";
      }

      if ("name" in body) {
        const name = cleanName(body.name);
        if (name.error) fields.name = name.error;
        else data.name = name.value;
      }

      if ("email" in body) {
        const email = cleanEmail(body.email);
        if (email.error) fields.email = email.error;
        else data.email = email.value;
      }

      if ("role" in body) {
        if (!ROLES.includes(body.role)) fields.role = "Choose a role.";
        else data.role = body.role;
      }

      if ("isActive" in body) {
        if (typeof body.isActive !== "boolean") {
          fields.isActive = "Active must be true or false.";
        } else {
          data.isActive = body.isActive;
        }
      }

      if (Object.keys(fields).length > 0) {
        return res.status(400).json(validation(fields));
      }

      const userId = Number(req.params.id);
      const prisma = getPrisma();

      const target = Number.isInteger(userId)
        ? await prisma.user.findUnique({ where: { id: userId } })
        : null;

      if (!target) {
        return res.status(404).json(NOT_FOUND);
      }

      if (typeof data.email === "string" && data.email !== target.email) {
        const taken = await prisma.user.findUnique({
          where: { email: data.email },
          select: { id: true },
        });

        if (taken) {
          return res
            .status(409)
            .json(
              errorBody("CONFLICT", "This email is already in use.", {
                email: "This email is already in use.",
              })
            );
        }
      }

      if (data.isActive === false && target.id === req.user!.id) {
        return res
          .status(409)
          .json(
            errorBody(
              "CONFLICT",
              "You cannot deactivate your own account."
            )
          );
      }

      // The system must always keep at least one active Administrator.
      const staysActiveAdmin =
        (data.role ?? target.role) === "ADMIN" &&
        (data.isActive ?? target.isActive) === true;

      if (target.role === "ADMIN" && target.isActive && !staysActiveAdmin) {
        const others = await prisma.user.count({
          where: {
            role: "ADMIN",
            isActive: true,
            id: { not: target.id },
          },
        });

        if (others === 0) {
          return res
            .status(409)
            .json(
              errorBody(
                "CONFLICT",
                "At least one active Administrator is required."
              )
            );
        }
      }

      const updated = await prisma.user.update({
        where: { id: target.id },
        data,
        select: publicUser,
      });

      return res.status(200).json(updated);
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);

adminRouter.post(
  "/admin/users/:id/initial-password",
  async (req: Request, res: Response) => {
    try {
      const problem = validateNewPassword(req.body?.initialPassword);

      if (problem) {
        return res
          .status(400)
          .json(validation({ initialPassword: problem }));
      }

      const userId = Number(req.params.id);
      const prisma = getPrisma();

      const target = Number.isInteger(userId)
        ? await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
          })
        : null;

      if (!target) {
        return res.status(404).json(NOT_FOUND);
      }

      await prisma.user.update({
        where: { id: target.id },
        data: {
          passwordHash: await bcrypt.hash(
            req.body.initialPassword,
            BCRYPT_COST
          ),
          mustChangePassword: true,
        },
      });

      return res
        .status(200)
        .json({ id: target.id, mustChangePassword: true });
    } catch (error) {
      logServerError(error);
      return res.status(500).json(SERVER_ERROR);
    }
  }
);
