import os
import stripe
from dotenv import load_dotenv

load_dotenv()

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_BASIC_PRICE_ID = os.getenv("STRIPE_BASIC_PRICE_ID")
STRIPE_ADVANCED_PRICE_ID = os.getenv("STRIPE_ADVANCED_PRICE_ID")

stripe.api_key = STRIPE_SECRET_KEY

# Create a Stripe customer if not already present
def create_stripe_customer(email, user_id):
    customer = stripe.Customer.create(
        email=email,
        metadata={"user_id": user_id}
    )
    return customer.id

# Create a Stripe Checkout session for a given plan and user
# plan: 'basic' or 'advanced'
def create_checkout_session(stripe_customer_id, plan, success_url, cancel_url):
    if plan == 'basic':
        price_id = STRIPE_BASIC_PRICE_ID
    elif plan == 'advanced':
        price_id = STRIPE_ADVANCED_PRICE_ID
    else:
        raise ValueError("Invalid plan type")

    session = stripe.checkout.Session.create(
        customer=stripe_customer_id,
        payment_method_types=["card"],
        line_items=[{
            'price': price_id,
            'quantity': 1,
        }],
        mode='subscription',
        success_url=success_url,
        cancel_url=cancel_url,
    )
    return session.url
