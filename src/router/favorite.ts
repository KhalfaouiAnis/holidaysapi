import { Elysia } from "elysia";
import { db } from "../db";
import { authPlugin } from "../middleware/auth";

export const favoriteRouter = new Elysia({ prefix: "/favorites" })
  .use(authPlugin)
  .post("/:property_id", async ({ params: { property_id }, user }) => {
    // Check if property exists
    const property = await db.property.findUnique({
      where: { id: property_id },
    });

    if (!property) {
      return new Response("Property not found", { status: 404 });
    }

    // Check if it's already favorited
    const existingFavorite = await db.favorite.findUnique({
      where: {
        user_id_property_id: {
          user_id: user.id,
          property_id,
        },
      },
    });

    if (existingFavorite) {
      // Remove from favorites
      await db.favorite.delete({
        where: {
          user_id_property_id: {
            user_id: user.id,
            property_id,
          },
        },
      });

      return {
        message: "Property removed from favorites",
        is_favorite: false,
      };
    } else {
      // Add to favorites
      await db.favorite.create({
        data: {
          user_id: user.id,
          property_id,
        },
      });

      return {
        message: "Property added to favorites",
        is_favorite: true,
      };
    }
  })
  .get("/", async ({ user }) => {
    const favorites = await db.property.findMany({
      where: {
        favorites: {
          some: {
            user_id: user.id,
          },
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
        favorites: {
          where: {
            user_id: user.id,
          },
          select: {
            user_id: true,
            created_at: true,
          },
        },
      },
    });

    // Transform the response to include isFavorite flag
    const transformedFavorites = favorites.map((property: IProperty) => ({
      ...property,
      isFavorite: true, // Since these are all favorites
      favorites: undefined, // Remove the favorites array from response
    }));

    return {
      favorites: transformedFavorites,
    };
  })
  .get("/:property_id/status", async ({ params: { property_id }, user }) => {
    const favorite = await db.favorite.findUnique({
      where: {
        user_id_property_id: {
          user_id: user.id,
          property_id,
        },
      },
    });

    return {
      is_favorite: !!favorite,
    };
  });
