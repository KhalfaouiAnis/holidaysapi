import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { db } from "../db";

console.log(process.env.JWT_TOKEN, "token");

export const authPlugin = (app: Elysia) =>
  app
    .use(
      jwt({
        secret: process.env.JWT_TOKEN as string,
      })
    )
    .derive({ as: "local" }, async ({ jwt, headers }) => {
      const token = headers.authorization;
      const payload = await jwt.verify(token);

      if (!payload) {
        throw new Response("Unauthorized", { status: 401 });
      }

      const user = await db.user.findUnique({
        where: {
          id: payload.sub as string,
        },
      });

      if (!user) {
        throw new Response("Unauthorized", { status: 401 });
      }

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatar,
        },
      };
    });
