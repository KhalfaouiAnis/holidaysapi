import { Elysia, t } from "elysia";
import { db } from "../db";

export const propertyListRouter = new Elysia({ prefix: "" }).get(
  "/properties-list",
  async ({ query }) => {
    const page = Number(query?.page || 1);
    const pageSize = Number(query?.pageSize || 10);
    const skip = (page - 1) * pageSize;

    const [properties, totalCount] = await Promise.all([
      db.property.findMany({
        take: pageSize,
        skip,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
      }),
      db.property.count(),
    ]);

    const propertiesWithFavorites = await Promise.all(
      properties.map(async (property: IProperty) => {
        return {
          ...property,
          is_favorite: false,
        };
      })
    );

    return {
      properties: propertiesWithFavorites,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  },
  {
    query: t.Object({
      page: t.Optional(t.String()),
      pageSize: t.Optional(t.String()),
    }),
  }
);
