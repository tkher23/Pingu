from flask import Flask, request, jsonify
import os
import pandas as pd
from backend import process_profiles_batch  # Import your processing logic
from flask_cors import CORS
import json
import requests
from stripe_utils import create_checkout_session
import stripe
from datetime import datetime, timedelta

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

def get_user_credits(user_id):
    url = f"{SUPABASE_URL}/rest/v1/user_profiles?id=eq.{user_id}&select=credits"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    }
    response = requests.get(url, headers=headers)
    if response.ok:
        data = response.json()
        if data and len(data) > 0:
            return data[0].get("credits", 0)
    print("⚠️ Could not retrieve user credits:", response.text)
    return 0

def get_user_id_from_token(token):
    try:
        response = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY
            }
        )
        if response.status_code == 200:
            return response.json().get("id")
        return None
    except Exception as e:
        print("Token verification error:", e)
        return None

def decrement_user_credits(user_id):
    url = f"{SUPABASE_URL}/rest/v1/rpc/decrement_credits"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    payload = {"user_id": user_id}
    response = requests.post(url, headers=headers, json=payload)
    if not response.ok:
        print("⚠️ Failed to decrement credits:", response.text)

def get_user_trial_status(user_id):
    url = f"{SUPABASE_URL}/rest/v1/user_profiles?id=eq.{user_id}&select=plan_type,credits,trial_end_date"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    }
    response = requests.get(url, headers=headers)
    if response.ok and response.json():
        user = response.json()[0]
        plan_type = user.get("plan_type", "trial")
        credits = user.get("credits", 0)
        trial_end_date = user.get("trial_end_date")
        return plan_type, credits, trial_end_date
    return "trial", 0, None

def initialize_trial_if_needed(user_id):
    # Check if user has trial fields set, if not, initialize
    url = f"{SUPABASE_URL}/rest/v1/user_profiles?id=eq.{user_id}&select=plan_type,trial_end_date,credits"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    }
    response = requests.get(url, headers=headers)
    if response.ok and response.json():
        user = response.json()[0]
        if not user.get("plan_type") or user.get("plan_type") == "trial":
            # If trial_end_date or credits not set, initialize
            needs_update = False
            patch = {}
            if not user.get("trial_end_date"):
                patch["trial_end_date"] = (datetime.utcnow() + timedelta(days=7)).date().isoformat()
                needs_update = True
            if user.get("credits") is None or user.get("credits", 0) == 0:
                patch["credits"] = 50
                needs_update = True
            if needs_update:
                patch["plan_type"] = "trial"
                patch_url = f"{SUPABASE_URL}/rest/v1/user_profiles?id=eq.{user_id}"
                patch_headers = headers.copy()
                patch_headers["Content-Type"] = "application/json"
                requests.patch(patch_url, headers=patch_headers, json=patch)

@app.route('/api/process-spreadsheet', methods=['POST'])
def process_spreadsheet():
    try:
        # Check if a file is provided
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']

        # Check if the file is allowed
        if not file.filename.endswith(('.csv', '.xlsx')):
            return jsonify({"error": "Unsupported file type. Please upload a .csv or .xlsx file."}), 400

        # Read the spreadsheet into a DataFrame
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file)
        else:
            df = pd.read_excel(file)

        # Convert DataFrame rows to a list of dictionaries
        profiles = []
        for _, row in df.iterrows():
            profiles.append({
                "linkedin": {"raw_text": row.get("LinkedIn Raw Text", "")},
                "bio_page": {"raw_text": row.get("Bio Page Raw Text", "")},
                "values_page": {"raw_text": row.get("Values Page Raw Text", "")},
                "internship_interest": row.get("Internship Interest", "")
            })

        # Process profiles and generate emails
        processed_profiles = process_profiles_batch(profiles)

        # Return the processed profiles as JSON
        return jsonify(processed_profiles), 200

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


# 🔥 New endpoint for Chrome Extension 🔥
@app.route('/api/process-single-profile', methods=['POST'])
def process_single_profile():
    try:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        user_id = get_user_id_from_token(token)
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401
        # 🟢 Initialize trial if needed
        initialize_trial_if_needed(user_id)
        # 🚫 Check if user has credits and trial status
        plan_type, user_credits, trial_end_date = get_user_trial_status(user_id)
        if plan_type == "trial":
            if trial_end_date:
                today = datetime.utcnow().date()
                trial_end = datetime.strptime(trial_end_date, "%Y-%m-%d").date()
                if today > trial_end:
                    return jsonify({"error": "Your free trial has expired. Please upgrade to continue."}), 403
        if user_credits <= 0:
            return jsonify({"error": "You’ve used all your credits. Please contact support or upgrade to request more."}), 403
        data = request.get_json()
        print("🟡 Received data:", json.dumps(data, indent=2))

        profile = {
            "linkedin": {"raw_text": data.get("linkedin", "")},
            "bio_page": {"raw_text": data.get("bio_page", "")},
            "values_page": {"raw_text": data.get("values_page", "")},
            "internship_interest": data.get("internship_interest", ""),
            "user_info": data.get("user_info", {}),
            "recipient_name": data.get("recipient_name", ""),
            "company_of_interest": data.get("user_info", {}).get("company_interest", ""),
            "role_type": data.get("user_info", {}).get("role_type", "internship")
        }

        processed = process_profiles_batch([profile], generate_email_flag=True, generate_subject_flag=False)

        # ✅ Subtract credit after successful processing
        decrement_user_credits(user_id)

        return jsonify(processed[0]), 200

    except Exception as e:
        print("❌ ERROR:", e)
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route('/api/generate-subject', methods=['POST'])
def generate_subject_route():
    try:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        user_id = get_user_id_from_token(token)
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        initialize_trial_if_needed(user_id)
        plan_type, user_credits, trial_end_date = get_user_trial_status(user_id)
        if plan_type == "trial":
            if trial_end_date:
                today = datetime.utcnow().date()
                trial_end = datetime.strptime(trial_end_date, "%Y-%m-%d").date()
                if today > trial_end:
                    return jsonify({"error": "Your free trial has expired. Please upgrade to continue."}), 403

        if user_credits <= 0:
            return jsonify({"error": "You’ve used all your credits. Please contact support or upgrade to request more."}), 403

        data = request.get_json()
        user_info = data.get("user_info", {})
        company = data.get("company_of_interest", "")

        profile = {
            "user_info": user_info,
            "company_of_interest": company
        }

        processed = process_profiles_batch([profile], generate_email_flag=False, generate_subject_flag=True)
        subject = processed[0].get("generated_subject", "")

        return jsonify({"subject": subject}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/simple-email', methods=['POST'])
def generate_simple_email_api():
    try:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        user_id = get_user_id_from_token(token)
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        initialize_trial_if_needed(user_id)
        plan_type, user_credits, trial_end_date = get_user_trial_status(user_id)
        if plan_type == "trial":
            if trial_end_date:
                today = datetime.utcnow().date()
                trial_end = datetime.strptime(trial_end_date, "%Y-%m-%d").date()
                if today > trial_end:
                    return jsonify({"error": "Your free trial has expired. Please upgrade to continue."}), 403

        if user_credits <= 0:
            return jsonify({"error": "You’ve used all your credits. Please contact support or upgrade to request more."}), 403

        data = request.get_json()
        print("📩 Simple Email Request:", json.dumps(data, indent=2))

        profile = {
            "internship_interest": data.get("internship_interest", ""),
            "user_info": data.get("user_info", {}),
            "recipient_name": data.get("recipient_name", ""),
            "company_of_interest": data.get("user_info", {}).get("company_interest", ""),
        }

        processed = process_profiles_batch([profile], generate_email_flag=True, generate_subject_flag=False, simple_email=True)

        decrement_user_credits(user_id)
        return jsonify(processed[0]), 200

    except Exception as e:
        print("❌ Simple Email ERROR:", e)
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route('/api/get-credits', methods=['GET'])
def get_credits():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_id_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    initialize_trial_if_needed(user_id)
    plan_type, credits, trial_end_date = get_user_trial_status(user_id)
    # Optionally, return trial status and end date
    return jsonify({"credits": credits, "plan_type": plan_type, "trial_end_date": trial_end_date}), 200

@app.route('/api/user-settings', methods=['GET'])
def get_user_settings():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_id_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    url = f"{SUPABASE_URL}/rest/v1/user_settings?id=eq.{user_id}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {token}"
    }
    response = requests.get(url, headers=headers)
    if response.ok:
        data = response.json()
        return jsonify(data[0] if data else {}), 200
    return jsonify({"error": "Failed to fetch user settings"}), 500

@app.route('/api/user-settings', methods=['POST'])
def update_user_settings():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_id_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    payload = request.get_json()
    payload["id"] = user_id  # ensure correct ID

    url = f"{SUPABASE_URL}/rest/v1/user_settings"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    response = requests.post(url, headers=headers, json=[payload])
    if response.ok:
        return jsonify({"success": True}), 200
    return jsonify({"error": "Failed to save settings"}), 500

@app.route('/api/create-checkout-session', methods=['POST'])
def create_checkout():
    try:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        user_id = get_user_id_from_token(token)
        print("DEBUG: user_id from token:", user_id)  # <-- Debug print
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401
        data = request.get_json()
        plan = data.get("plan")  # 'basic' or 'advanced'
        success_url = data.get("success_url")
        cancel_url = data.get("cancel_url")
        # Fetch user email and stripe_customer_id from Supabase
        url = f"{SUPABASE_URL}/rest/v1/user_profiles?id=eq.{user_id}&select=email,stripe_customer_id"
        print("DEBUG: Supabase user_profiles URL:", url)  # <-- Debug print
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
        }
        response = requests.get(url, headers=headers)
        print("DEBUG: Supabase response status:", response.status_code)  # <-- Debug print
        print("DEBUG: Supabase response JSON:", response.text)  # <-- Debug print
        if not response.ok or not response.json():
            return jsonify({"error": "User not found"}), 404
        user = response.json()[0]
        email = user.get("email")
        stripe_customer_id = user.get("stripe_customer_id")
        # If no Stripe customer, create one and update Supabase
        if not stripe_customer_id:
            from stripe_utils import create_stripe_customer
            stripe_customer_id = create_stripe_customer(email, user_id)
            patch_url = f"{SUPABASE_URL}/rest/v1/user_profiles?id=eq.{user_id}"
            patch_headers = headers.copy()
            patch_headers["Content-Type"] = "application/json"
            requests.patch(patch_url, headers=patch_headers, json={"stripe_customer_id": stripe_customer_id})
        # Create checkout session
        session_url = create_checkout_session(stripe_customer_id, plan, success_url, cancel_url)
        return jsonify({"url": session_url}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/stripe-webhook', methods=['POST'])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get('stripe-signature')
    event = None
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        return jsonify({'error': f'Webhook error: {str(e)}'}), 400
    # Handle subscription events
    if event['type'] == 'customer.subscription.created' or event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        stripe_customer_id = subscription['customer']
        status = subscription['status']
        # Find user by stripe_customer_id and update plan_type, subscription_status, credits
        # (You may want to check which plan by looking at subscription['items']['data'][0]['price']['id'])
        url = f"{SUPABASE_URL}/rest/v1/user_profiles?stripe_customer_id=eq.{stripe_customer_id}"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json"
        }
        # Determine plan and credits
        plan_type = None
        credits = None
        price_id = subscription['items']['data'][0]['price']['id']
        if price_id == os.getenv("STRIPE_BASIC_PRICE_ID"):
            plan_type = 'basic'
            credits = 150
        elif price_id == os.getenv("STRIPE_ADVANCED_PRICE_ID"):
            plan_type = 'advanced'
            credits = 1000
        else:
            plan_type = 'unknown'
            credits = 0
        patch = {
            "plan_type": plan_type,
            "subscription_status": status,
            "credits": credits,
            "subscription_updated_at": stripe.util.convert_to_datetime(subscription['current_period_end'])
        }
        requests.patch(url, headers=headers, json=patch)
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        stripe_customer_id = subscription['customer']
        url = f"{SUPABASE_URL}/rest/v1/user_profiles?stripe_customer_id=eq.{stripe_customer_id}"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json"
        }
        patch = {
            "plan_type": 'trial',
            "subscription_status": 'canceled'
        }
        requests.patch(url, headers=headers, json=patch)
    return '', 200

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)