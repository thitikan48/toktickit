import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { getPrisma } from "./prisma.js";
import { validateNewPassword } from "./rules.js";

const BCRYPT_COST = 12;
const SESSION_IDLE_MS = 30 * 60 * 1000;

// Used to keep login timing similar when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync(
  "not-a-real-password-1",
  BCRYPT_COST
);

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMIN";
  isActive: boolean;
  mustChangePassword: boolean;
}

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function sessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production.");
  }

  // Local development and tests: a random secret per server start.
  return randomBytes(32).toString("hex");
}

export const sessionMiddleware = session({
  name: "tokticit.sid",
  secret: sessionSecret(),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_IDLE_MS,
  },
});

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

const SERVER_ERROR = errorBody(
  "SERVER_ERROR",
  "Something went wrong. Please try again."
);

function toMe(user: AuthUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

/**
 * Reloads the user from the database on every request, so deactivation,
 * role changes, and password-change requirements apply immediately.
 */
export async function loadUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = req.session?.userId;

  if (!userId) {
    return next();
  }

  try {
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
      },
    });

    if (user && user.isActive) {
      req.user = user;
    } else {
      req.session.destroy(() => undefined);
    }

    return next();
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
}

function requireLogin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res
      .status(401)
      .json(
        errorBody(
          "UNAUTHENTICATED",
          "Please log in to continue."
        )
      );
  }

  return next();
}

/**
 * Login required, and the initial password must already have been changed.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return requireLogin(req, res, next);
  }

  if (req.user.mustChangePassword) {
    return res
      .status(403)
      .json(
        errorBody(
          "PASSWORD_CHANGE_REQUIRED",
          "You must change your initial password first."
        )
      );
  }

  return next();
}

function regenerate(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) =>
      error ? reject(error) : resolve()
    );
  });
}

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  try {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body?.password === "string"
        ? req.body.password
        : "";

    if (!email || !password) {
      const fields: Record<string, string> = {};
      if (!email) fields.email = "Email is required.";
      if (!password) fields.password = "Password is required.";

      return res
        .status(400)
        .json(
          errorBody(
            "VALIDATION_ERROR",
            "The request contains invalid or missing data.",
            fields
          )
        );
    }

    const user = await getPrisma().user.findUnique({
      where: { email },
    });

    const passwordMatches = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_HASH
    );

    if (!user || !passwordMatches) {
      return res
        .status(401)
        .json(
          errorBody(
            "INVALID_CREDENTIALS",
            "Invalid email or password."
          )
        );
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json(
          errorBody(
            "ACCOUNT_INACTIVE",
            "This account is inactive. Contact an administrator."
          )
        );
    }

    await regenerate(req);
    req.session.userId = user.id;

    return res.status(200).json({ user: toMe(user) });
  } catch {
    return res.status(500).json(SERVER_ERROR);
  }
});

authRouter.post("/logout", requireLogin, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("tokticit.sid");
    res.status(204).end();
  });
});

authRouter.get("/me", requireLogin, (req, res) => {
  res.status(200).json({ user: toMe(req.user!) });
});

authRouter.post(
  "/change-password",
  requireLogin,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } =
        req.body ?? {};
      const prisma = getPrisma();

      const record = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });

      if (
        typeof currentPassword !== "string" ||
        !record ||
        !(await bcrypt.compare(
          currentPassword,
          record.passwordHash
        ))
      ) {
        return res
          .status(400)
          .json(
            errorBody(
              "VALIDATION_ERROR",
              "The request contains invalid or missing data.",
              {
                currentPassword:
                  "Current password is incorrect.",
              }
            )
          );
      }

      const problem = validateNewPassword(
        newPassword,
        currentPassword
      );

      if (problem) {
        return res
          .status(400)
          .json(
            errorBody(
              "VALIDATION_ERROR",
              "The request contains invalid or missing data.",
              { newPassword: problem }
            )
          );
      }

      const updated = await prisma.user.update({
        where: { id: record.id },
        data: {
          passwordHash: await bcrypt.hash(
            newPassword,
            BCRYPT_COST
          ),
          mustChangePassword: false,
        },
      });

      await regenerate(req);
      req.session.userId = updated.id;

      return res.status(200).json({ user: toMe(updated) });
    } catch {
      return res.status(500).json(SERVER_ERROR);
    }
  }
);
