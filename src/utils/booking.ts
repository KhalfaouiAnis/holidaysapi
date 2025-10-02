import { BookingStatus } from "@prisma/client";
import { type Stripe } from "stripe";

export function parseStripePaymentStatus(
  status: Stripe.PaymentIntent.Status
): BookingStatus {
  switch (status) {
    case "succeeded":
      return BookingStatus.SUCCEEDED;
    default:
      return BookingStatus.FAILED;
  }
}
