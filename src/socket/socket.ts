import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { onClose, onMessage, onOpen } from "../services/socket-handlers";
import { NotificationType } from "@prisma/client";

const PayloadSchema = t.Object({
  title: t.Optional(t.String()),
  targetUserId: t.Optional(t.String()),
  notificationId: t.Optional(t.String()),
  message: t.String(),
});

const wsOptions = {
  body: t.Object({
    type: t.Enum(NotificationType),
    payload: PayloadSchema,
  }),
};

export const socket = new Elysia().use(
  jwt({
    secret: Bun.env.JWT_TOKEN_SECRET as string,
  })
);

socket.decorate("claims", { user: {} as { id: string } });

socket.ws("/ws", {
  ...wsOptions,
  open: (ws) => onOpen(ws),
  message: (ws, message) => onMessage(ws, message),
  close: (ws) => onClose(ws),
});

export type SocketType = typeof socket;
