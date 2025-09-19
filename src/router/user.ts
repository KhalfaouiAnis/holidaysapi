import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import { db } from "../db";
import { authPlugin } from "../middleware/auth";

export const userRouter = new Elysia({ prefix: "/users" })
  .use(
    jwt({
      secret: Bun.env.JWT_TOKEN as string,
    })
  )
  .guard(
    {
      body: t.Object({
        name: t.String(),
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 6 }),
      }),
    },
    (app) =>
      app.post("/", async ({ body }) => {
        const { name, email, password } = body;
        const username = email.split("@")[0];

        try {
          const hashedPassword = await Bun.password.hash(password);

          const user = await db.user.create({
            data: {
              name,
              email,
              username,
              password: hashedPassword,
              avatar: getRandomAvatar(), // Implement this based on your needs
            },
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              avatar: true,
            },
          });

          return {
            message: "User created successfully",
            user,
          };
        } catch {
          return new Response("User already exists", { status: 400 });
        }
      })
  )
  .post(
    "/login",
    async ({ body, jwt }) => {
      const { email, password } = body;

      const user = await db.user.findUnique({
        where: { email },
      });

      if (!user) {
        return new Response("Invalid credentials", { status: 401 });
      }

      const validPassword = await Bun.password.verify(password, user.password);
      if (!validPassword) {
        return new Response("Invalid credentials", { status: 401 });
      }

      const token = await jwt.sign({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
        iat: undefined,
      });

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          avatar: user.avatar,
        },
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String(),
      }),
    }
  )
  .use(authPlugin)
  .get("/me", async ({ user }) => {
    return { user };
  })
  .get("/stats", async ({ user }) => {
    const [favoriteCount, bookingCount] = await Promise.all([
      db.favorite.count({
        where: { user_id: user.id },
      }),
      db.booking.count({
        where: { user_id: user.id },
      }),
    ]);

    return {
      stats: {
        ...user,
        favoritePropertiesCount: favoriteCount,
        bookingsCount: bookingCount,
      },
    };
  })
  .patch(
    "/me",
    async ({ user, body }) => {
      const updatedUser = await db.user.update({
        where: { id: user.id },
        data: body,
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          avatar: true,
        },
      });

      return {
        message: "Profile updated successfully",
        user: updatedUser,
      };
    },
    {
      body: t.Partial(
        t.Object({
          name: t.String(),
          username: t.String(),
        })
      ),
    }
  )
  .delete("/me", async ({ user }) => {
    await db.user.delete({
      where: { id: user.id },
    });

    return {
      message: "Account deleted successfully",
    };
  });

function getRandomAvatar() {
  const avatars = [
    "https://images.unsplash.com/photo-1557682224-5b8590cd9ec5",
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
    "https://images.unsplash.com/photo-1618556450994-a6a128ef0d9d",
    "https://images.unsplash.com/photo-1604076850742-4c7221f3101b",
  ];

  return avatars[Math.floor(Math.random() * avatars.length)];
}
