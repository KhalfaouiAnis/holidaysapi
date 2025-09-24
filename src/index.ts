import { logger } from "@bogeychan/elysia-logger";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { ip } from "elysia-ip";
import { rateLimit } from "elysia-rate-limit";
import { bookingRouter } from "./router/booking";
import { favoriteRouter } from "./router/favorite";
import { propertyRouter } from "./router/property";
import { userRouter } from "./router/user";
import { webhookRouter } from "./services/webhook";
import { socket } from "./socket/socket";
import { NotificationRoute } from "./router/notification";

const app = new Elysia()
  .use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      credentials: true,
    })
  )
  .use(logger())
  .use(ip())
  .use(
    rateLimit({
      max: 100, // requests
      duration: 60000, // per minute
    })
  )
  .use(
    swagger({
      path: "/swagger",
    })
  )
  .get("/", () => ({ message: "Welcome to Elysia" }))
  .get("/health", () => ({ status: "ok" }))
  .use(userRouter)
  .use(propertyRouter)
  .use(bookingRouter)
  .use(favoriteRouter)
  .use(webhookRouter)
  .use(NotificationRoute)
  .use(socket)
  .listen(process.env.PORT || 3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

app.onError(({ code, error, set }) => {
  console.error(`Error [${code}]:`, error);
  switch (code) {
    case "VALIDATION":
      set.status = 400;
      return { error: "Invalid request data" };
    case "NOT_FOUND":
      set.status = 404;
      return { error: error.message };
    case "INTERNAL_SERVER_ERROR":
      set.status = 401;
      return { error: "Authentication required" };
    case "UNKNOWN":
      set.status = 403;
      return { error: "Access denied" };
    default:
      set.status = 500;
      return { error: "Internal server error" };
  }
});

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
      JWT_SECRET: string;
      DATABASE_URL: string;
      STRIPE_SECRET_KEY: string;
      STRIPE_WEBHOOK_SECRET: string;
    }
  }
}
