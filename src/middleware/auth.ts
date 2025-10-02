import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { db } from "../db";
import { NotFoundException, UnauthorizedException } from "elysia-http-exception";

export const authPlugin = (app: Elysia) =>
  app
    .use(
      jwt({
        secret: process.env.JWT_TOKEN_SECRET as string,
      })
    )
    .derive({ as: "local" }, async ({ jwt, headers }) => {
      const token = headers.authorization;
      const payload = await jwt.verify(token);

      if (!payload) {
        throw new UnauthorizedException('Access Unauthorized');
      }

      const user = await db.user.findUnique({
        where: {
          id: payload.sub as string,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email,
          avatar: user.avatar,
        },
      };
    });
