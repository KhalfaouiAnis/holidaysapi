import { Elysia } from "elysia";
import Stripe from "stripe";
import { db } from "../db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

export const webhookRouter = new Elysia({ prefix: "/webhook" })
  .onParse(async ({ request, headers }) => {
    if (headers["content-type"] === "application/json; charset=utf-8") {
      const arrayBuffer = await Bun.readableStreamToArrayBuffer(request.body!);
      const rawBody = Buffer.from(arrayBuffer);
      return rawBody;
    }
  })
  .post("/", async ({ request, body }) => {
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      throw new Error("No signature provided");
    }

    let event: Stripe.Event;
    console.log({ signature });

    try {
      event = await stripe.webhooks.constructEventAsync(
        body as unknown as string,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error(`⚠️ Webhook signature verification failed:`, err);
      throw new Error(`Webhook Error: `);
    }

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          // Find booking by payment intent ID
          const booking = await db.booking.findFirst({
            where: { payment_intent_id: paymentIntent.id },
          });

          if (!booking) {
            throw new Error(
              `No booking found for payment intent ${paymentIntent.id}`
            );
          }

          // Update booking status
          await db.booking.update({
            where: { id: booking.id },
            data: {
              payment_status: "succeeded",
              status: "confirmed",
            },
          });

          console.log(`💰 Payment succeeded for booking ${booking.id}`);
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          const booking = await db.booking.findFirst({
            where: { payment_intent_id: paymentIntent.id },
          });

          if (!booking) {
            throw new Error(
              `No booking found for payment intent ${paymentIntent.id}`
            );
          }

          // Update booking status
          await db.booking.update({
            where: { id: booking.id },
            data: {
              payment_status: "failed",
              status: "payment_failed",
            },
          });

          console.log(`❌ Payment failed for booking ${booking.id}`);
          break;
        }

        case "payment_intent.requires_action": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          const booking = await db.booking.findFirst({
            where: { payment_intent_id: paymentIntent.id },
          });

          if (booking) {
            await db.booking.update({
              where: { id: booking.id },
              data: {
                status: "requires_action",
              },
            });
          }
          break;
        }

        case "payment_intent.canceled": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          const booking = await db.booking.findFirst({
            where: { payment_intent_id: paymentIntent.id },
          });

          if (booking) {
            await db.booking.update({
              where: { id: booking.id },
              data: {
                payment_status: "cancelled",
                status: "cancelled",
              },
            });
          }
          break;
        }

        // Add other event types as needed
        default:
          console.log(`⚠️ Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (err) {
      console.error(`❌ Error processing webhook:`, err);
      // @ts-ignore
      throw new Error(`Webhook handler failed: ${err.message}`);
    }
  });
