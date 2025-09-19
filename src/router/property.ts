import { Elysia, t } from "elysia";
import { db } from "../db";
import { authPlugin } from "../middleware/auth";

const PropertyInput = t.Object({
  name: t.String(),
  description: t.String(),
  price_per_night: t.Number(),
  address: t.String(),
  city: t.String(),
  country: t.String(),
  amenities: t.String(),
  capacity: t.Number(),
  images: t.Array(t.String()),
  longitude: t.Number(),
  latitude: t.Number(),
  longitude_delta: t.Number(),
  latitude_delta: t.Number(),
});

export const propertyRouter = new Elysia({ prefix: "/properties" })
  .use(authPlugin)
  .post(
    "/",
    async ({ user, body }) => {
      const property = await db.property.create({
        data: {
          ...body,
          ownerId: user.id,
        },
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
      });

      return {
        message: "Property created successfully",
        property,
      };
    },
    {
      body: PropertyInput,
    }
  )
  .get(
    "/",
    async ({ query, user }) => {
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

      // Check favorite status for each property
      const propertiesWithFavorites = await Promise.all(
        properties.map(async (property: IProperty) => {
          const isFavorite = await db.favorite.findFirst({
            where: {
              user_id: user.id,
              property_id: property.id,
            },
          });
          return {
            ...property,
            is_favorite: !!isFavorite,
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
  )
  .get(
    "/search",
    async ({ query, user }) => {
      if (!query.city) {
        return new Response("City parameter is required", { status: 400 });
      }

      const properties = await db.property.findMany({
        where: {
          city: {
            contains: query.city,
            mode: "insensitive",
          },
        },
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
      });

      // Check favorite status
      const propertiesWithFavorites = await Promise.all(
        properties.map(async (property: IProperty) => {
          const isFavorite = await db.favorite.findFirst({
            where: {
              user_id: user.id,
              property_id: property.id,
            },
          });
          return {
            ...property,
            is_favorite: !!isFavorite,
          };
        })
      );

      return {
        properties: propertiesWithFavorites,
      };
    },
    {
      query: t.Object({
        city: t.String(),
      }),
    }
  )
  .get(
    "/newest",
    async ({ query, user }) => {
      const page = Number(query?.page || 1);
      const pageSize = Number(query?.pageSize || 10);
      const skip = (page - 1) * pageSize;

      const [properties, totalCount] = await Promise.all([
        db.property.findMany({
          take: pageSize,
          skip,
          orderBy: {
            created_at: "desc",
          },
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
        }),
        db.property.count(),
      ]);

      // Check favorite status
      const propertiesWithFavorites = await Promise.all(
        properties.map(async (property: IProperty) => {
          const isFavorite = await db.favorite.findFirst({
            where: {
              user_id: user.id,
              property_id: property.id,
            },
          });
          return {
            ...property,
            is_favorite: !!isFavorite,
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
  )
  .get("/:id", async ({ params: { id }, user }) => {
    const property = await db.property.findUnique({
      where: { id },
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
    });

    if (!property) {
      return new Response("Property not found", { status: 404 });
    }

    // Check favorite status
    const isFavorite = await db.favorite.findFirst({
      where: {
        user_id: user.id,
        property_id: id,
      },
    });

    return {
      property: {
        ...property,
        is_favorite: !!isFavorite,
      },
    };
  })
  .patch(
    "/:id",
    async ({ params: { id }, body, user }) => {
      const property = await db.property.findUnique({
        where: { id },
      });

      if (!property) {
        return new Response("Property not found", { status: 404 });
      }

      if (property.ownerId !== user.id) {
        return new Response("Not authorized to update this property", {
          status: 403,
        });
      }

      const updatedProperty = await db.property.update({
        where: { id },
        data: body,
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
      });

      return {
        message: "Property updated successfully",
        property: updatedProperty,
      };
    },
    {
      body: t.Partial(PropertyInput),
    }
  )
  .delete("/:id", async ({ params: { id }, user }) => {
    const property = await db.property.findUnique({
      where: { id },
    });

    if (!property) {
      return new Response("Property not found", { status: 404 });
    }

    if (property.ownerId !== user.id) {
      return new Response("Not authorized to delete this property", {
        status: 403,
      });
    }

    await db.property.delete({
      where: { id },
    });

    return {
      message: "Property deleted successfully",
    };
  });
