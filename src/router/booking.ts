import { Elysia, t } from "elysia";
import Stripe from "stripe";
import { db } from "../db";
import { authPlugin } from "../middleware/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const BookingInput = t.Object({
  property_id: t.String(),
  check_in: t.String(),
  check_out: t.String(),
  guest_count: t.Number(),
  special_requests: t.Optional(t.String()),
});

export const bookingRouter = new Elysia()
  .use(authPlugin)
  .post(
    "bookings/",
    async ({ body, user }) => {
      console.log(body);
      console.log("incoming request");
      const check_in = new Date(body.check_in);
      const check_out = new Date(body.check_out);

      // Validate dates
      if (check_in > check_out) {
        console.log("check_in", check_in);
        return new Response("Check-out must be after check-in", { status: 400 });
      }

      const property = await db.property.findUnique({
        where: { id: body.property_id },
      });

      if (!property) {
        return new Response("Property not found", { status: 404 });
      }

      const existingBooking = await db.booking.findFirst({
        where: {
          property_id: body.property_id,
          OR: [
            {
              AND: [
                { check_in: { lte: check_out } },
                { check_out: { gte: check_in } },
              ],
            },
          ],
          NOT: {
            OR: [{ status: "cancelled" }, { payment_status: "failed" }],
          },
        },
      });

      if (existingBooking) {
        return new Response("Property is not available for these dates", { status: 409 });
      }

      const nights =
        Math.ceil(
          (check_out.getTime() - check_in.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
      const total_price = property.price_per_night * nights;

      try {
        const customer = await stripe.customers.create({
          name: user?.name,
          email: user?.email,
        });

        const ephemeralKey = await stripe.ephemeralKeys.create(
          { customer: customer.id },
          { apiVersion: "2024-11-20.acacia" }
        );

        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(total_price * 100),
          currency: "inr",
          customer: customer.id,
          payment_method_types: ["card"],
          metadata: {
            property_id: property.id,
            user_id: user?.id,
            nights: nights.toString(),
          },
        });

        const booking = await db.booking.create({
          data: {
            property_id: body.property_id,
            user_id: user?.id,
            check_in,
            check_out,
            total_price,
            status: "pending",
            guest_count: body.guest_count,
            special_requests: body.special_requests,
            payment_intent_id: paymentIntent.id,
            payment_status: "pending",
          },
          include: {
            property: true,
            user: {
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
          message: "Booking created successfully",
          booking_id: booking.id,
          clientSecret: paymentIntent.client_secret,
          ephemeralKey: ephemeralKey.secret,
          customerId: customer.id,
          paymentIntent: paymentIntent.client_secret,
        };
      } catch {
        return new Response("Failed to process payment setup", { status: 500 });
      }
    },
    {
      body: BookingInput,
    }
  )
  .get(
    "/users/bookings",
    async ({ query, user }) => {
      const page = Number(query?.page || 1);
      const pageSize = Number(query?.pageSize || 10);
      const skip = (page - 1) * pageSize;

      const [bookings, totalCount] = await Promise.all([
        db.booking.findMany({
          where: {
            user_id: user?.id,
          },
          include: {
            property: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                username: true,
                avatar: true,
              },
            },
            review: true,
          },
          skip,
          take: pageSize,
          orderBy: {
            created_at: "desc",
          },
        }),
        db.booking.count({
          where: {
            user_id: user?.id,
          },
        }),
      ]);

      return {
        bookings,
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
  .get("bookings/:id", async ({ params: { id }, user }) => {
    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        property: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            avatar: true,
          },
        },
        review: true,
      },
    });

    if (!booking) {
      return new Response("Booking not found", { status: 404 });
    }

    if (booking.user_id !== user?.id) {
      return new Response("Not authorized to view this booking", { status: 403 });
    }

    return { booking };
  })
  .patch(
    "bookings/:id",
    async ({ params: { id }, body, user }) => {
      const booking = await db.booking.findUnique({
        where: { id },
        include: {
          property: true,
        },
      });

      if (!booking) {
       return new Response("Booking not found", { status: 404 });
      }

      if (booking.user_id !== user?.id) {
       return new Response("Not authorized to update this booking", { status: 403 });
      }

      if (booking.status === "completed" || booking.status === "cancelled") {
       return new Response("Cannot modify completed or cancelled bookings", { status: 400 });
      }

      let newTotalPrice = booking.total_price;
      let updateData: any = {};

      if (body.check_in || body.check_out) {
        const check_in = new Date(body.check_in || booking.check_in);
        const check_out = new Date(body.check_out || booking.check_out);

        if (check_in >= check_out) {
         return new Response("Check-out must be after check-in", { status: 400 });
        }

        const existingBooking = await db.booking.findFirst({
          where: {
            property_id: booking.property_id,
            id: { not: id },
            OR: [
              {
                AND: [
                  { check_in: { lte: check_out } },
                  { check_out: { gte: check_in } },
                ],
              },
            ],
            NOT: {
              OR: [{ status: "cancelled" }, { payment_status: "failed" }],
            },
          },
        });

        if (existingBooking) {
         return new Response("Property is not available for these dates", { status: 409 });
        }

        const nights =
          Math.ceil(
            (check_out.getTime() - check_in.getTime()) / (1000 * 60 * 60 * 24)
          ) + 1;
        newTotalPrice = booking.property.price_per_night * nights;

        updateData = {
          ...updateData,
          check_in,
          check_out,
          total_price: newTotalPrice,
        };
      }

      if (body.guest_count) {
        updateData.guest_count = body.guest_count;
      }

      if (body.special_requests) {
        updateData.special_requests = body.special_requests;
      }

      const updatedBooking = await db.booking.update({
        where: { id },
        data: updateData,
        include: {
          property: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              avatar: true,
            },
          },
          review: true,
        },
      });

      // If price changed, update payment intent
      if (newTotalPrice !== booking.total_price) {
        try {
          if (!booking.payment_intent_id) {
           return new Response("Payment intent not found", { status: 400 });
          }
          await stripe.paymentIntents.update(booking.payment_intent_id, {
            amount: Math.round(newTotalPrice * 100),
          });
        } catch {
         return new Response("Failed to update payment amount", { status: 500 });
        }
      }

      return {
        message: "Booking updated successfully",
        booking: updatedBooking,
      };
    },
    {
      body: t.Partial(BookingInput),
    }
  )
  .delete("bookings/:id", async ({ params: { id }, user }) => {
    const booking = await db.booking.findUnique({
      where: { id },
    });

    if (!booking) {
     return new Response("Booking not found", { status: 404 });
    }

    if (booking.user_id !== user?.id) {
     return new Response("Not authorized to delete this booking", { status: 403 });
    }

    if (booking.status === "completed") {
     return new Response("Cannot delete completed bookings", { status: 400 });
    }

    try {
      if (booking.payment_intent_id && booking.payment_status === "pending") {
        await stripe.paymentIntents.cancel(booking.payment_intent_id);
      }

      await db.booking.update({
        where: { id },
        data: {
          status: "cancelled",
          payment_status: "cancelled",
        },
      });

      return {
        message: "Booking cancelled successfully",
      };
    } catch {
     return new Response("Failed to cancel booking", { status: 500 });
    }
  });
