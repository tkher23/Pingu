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
import logging
import sys

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
BRIGHT_DATA_TOKEN = os.getenv("BRIGHT_DATA_TOKEN")
BRIGHT_DATA_DATASET_ID = os.getenv("BRIGHT_DATA_DATASET_ID")


# --- Logging setup for Render (stdout, global) ---
logging.basicConfig(
    level=logging.INFO,
    format='[WEBHOOK] %(asctime)s %(levelname)s %(message)s',
    stream=sys.stdout
)
# --- End logging setup ---

def log_to_file(msg):
    logging.info(msg)

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

def decrement_user_credits(user_id, amount=1):
    url = f"{SUPABASE_URL}/rest/v1/rpc/decrement_credits"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    payload = {"user_id": user_id, "amount": amount}
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
        # 🚫 Check if user has credits and trial/subscription status
        # Fetch all relevant fields
        url = f"{SUPABASE_URL}/rest/v1/user_profiles?id=eq.{user_id}&select=plan_type,credits,trial_end_date,subscription_updated_at,subscription_status"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
        }
        response = requests.get(url, headers=headers)
        if not response.ok or not response.json():
            return jsonify({"error": "User profile not found"}), 404
        user = response.json()[0]
        plan_type = user.get("plan_type", "trial")
        user_credits = user.get("credits", 0)
        trial_end_date = user.get("trial_end_date")
        subscription_updated_at = user.get("subscription_updated_at")
        subscription_status = user.get("subscription_status")
        today = datetime.utcnow()
        # Access control logic
        if plan_type == "trial":
            if trial_end_date:
                trial_end = datetime.strptime(trial_end_date, "%Y-%m-%d").date()
                if today.date() > trial_end:
                    return jsonify({"error": "Your free trial has expired. Please upgrade to continue."}), 403
        elif plan_type in ("basic", "advanced"):
            # Block if subscription is not active or expired
            if not subscription_updated_at or not subscription_status or subscription_status != "active":
                return jsonify({"error": "Your subscription is not active. Please renew to continue."}), 403
            try:
                sub_end = datetime.fromisoformat(subscription_updated_at)
            except Exception:
                sub_end = datetime.strptime(subscription_updated_at, "%Y-%m-%d").date()
            if today > sub_end:
                return jsonify({"error": "Your subscription has expired. Please renew to continue."}), 403
        if user_credits < 2:
            return jsonify({"error": "You need at least 2 credits to generate an advanced email. Please upgrade or contact support."}), 403
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
        decrement_user_credits(user_id, amount=2)  # Use 2 credits for advanced email
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
        # Fetch all relevant fields for robust access control
        url = f"{SUPABASE_URL}/rest/v1/user_profiles?id=eq.{user_id}&select=plan_type,credits,trial_end_date,subscription_updated_at,subscription_status"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
        }
        response = requests.get(url, headers=headers)
        if not response.ok or not response.json():
            return jsonify({"error": "User profile not found"}), 404
        user = response.json()[0]
        plan_type = user.get("plan_type", "trial")
        user_credits = user.get("credits", 0)
        trial_end_date = user.get("trial_end_date")
        subscription_updated_at = user.get("subscription_updated_at")
        subscription_status = user.get("subscription_status")
        today = datetime.utcnow()
        # Access control logic (same as process_single_profile)
        if plan_type == "trial":
            if trial_end_date:
                trial_end = datetime.strptime(trial_end_date, "%Y-%m-%d").date()
                if today.date() > trial_end:
                    return jsonify({"error": "Your free trial has expired. Please upgrade to continue."}), 403
        elif plan_type in ("basic", "advanced"):
            if not subscription_updated_at or not subscription_status or subscription_status != "active":
                return jsonify({"error": "Your subscription is not active. Please renew to continue."}), 403
            try:
                sub_end = datetime.fromisoformat(subscription_updated_at)
            except Exception:
                sub_end = datetime.strptime(subscription_updated_at, "%Y-%m-%d").date()
            if today > sub_end:
                return jsonify({"error": "Your subscription has expired. Please renew to continue."}), 403
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

        decrement_user_credits(user_id, amount=1)  # Use 1 credit for simple email
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
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"  # Use service role for RLS bypass
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
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",  # Use service role for RLS bypass
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    response = requests.post(url, headers=headers, json=[payload])
    if response.ok:
        return jsonify({"success": True}), 200
    print("❌ Failed to save user settings:", response.status_code, response.text)
    return jsonify({"error": f"Failed to save settings: {response.text}"}), 500

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
            return jsonify({"error": f"{response.status_code} {response.text}"}), 404        
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
        log_to_file(f"❌ Webhook signature error: {e}")
        return jsonify({'error': f'Webhook error: {str(e)}'}), 400
    log_to_file(f"✅ Stripe webhook received: {event.get('type')}")
    # Handle subscription events
    if event['type'] == 'customer.subscription.created' or event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        stripe_customer_id = subscription['customer']
        status = subscription['status']
        price_id = subscription['items']['data'][0]['price']['id']
        log_to_file(f"Stripe customer: {stripe_customer_id}, status: {status}, price_id: {price_id}")
        log_to_file(f"ENV STRIPE_BASIC_PRICE_ID: {os.getenv('STRIPE_BASIC_PRICE_ID')}")
        log_to_file(f"ENV STRIPE_ADVANCED_PRICE_ID: {os.getenv('STRIPE_ADVANCED_PRICE_ID')}")
        log_to_file(f"Stripe subscription object: {json.dumps(subscription, default=str)}")
        # Try top-level first, then fallback to the first item
        current_period_end = subscription.get('current_period_end')
        if not current_period_end and subscription.get('items', {}).get('data'):
            current_period_end = subscription['items']['data'][0].get('current_period_end')
        log_to_file(f"Stripe current_period_end: {current_period_end}")
        # Convert current_period_end to ISO string if present
        if current_period_end:
            dt = datetime.utcfromtimestamp(current_period_end)
            subscription_updated_at = dt.isoformat() + 'Z'  # Add Z for UTC
        else:
            subscription_updated_at = None
        url = f"{SUPABASE_URL}/rest/v1/user_profiles?stripe_customer_id=eq.{stripe_customer_id}"
        log_to_file(f"PATCH URL: {url}")
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json"
        }
        plan_type = None
        credits = None
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
            "subscription_updated_at": subscription_updated_at,
            "trial_end_date": None
        }
        log_to_file(f"PATCH DATA: {json.dumps(patch, default=str)}")
        try:
            resp = requests.patch(url, headers=headers, json=patch)
            log_to_file(f"PATCH response: {resp.status_code} {resp.text}")
        except Exception as e:
            log_to_file(f"❌ PATCH request error: {e}")
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
        log_to_file(f"PATCH DATA (deleted): {json.dumps(patch, default=str)}")
        try:
            resp = requests.patch(url, headers=headers, json=patch)
            log_to_file(f"PATCH response (deleted): {resp.status_code} {resp.text}")
        except Exception as e:
            log_to_file(f"❌ PATCH request error (deleted): {e}")
    elif event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        stripe_customer_id = session.get('customer')
        subscription_id = session.get('subscription')
        log_to_file(f"Handled checkout.session.completed for customer {stripe_customer_id}, subscription {subscription_id}")
        # Optionally, add logic here to update Supabase if needed
        return '', 200
    return '', 200

@app.route('/api/user-profile', methods=['GET'])
def get_user_profile():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_id_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    url = f"{SUPABASE_URL}/rest/v1/user_profiles?id=eq.{user_id}&select=plan_type,trial_end_date,subscription_updated_at,credits"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    }
    response = requests.get(url, headers=headers)
    if response.ok and response.json():
        return jsonify(response.json()[0]), 200
    return jsonify({}), 200

# === BrightData LinkedIn Scraping Endpoints ===
@app.route('/api/scrape-linkedin', methods=['POST'])
def trigger_linkedin_scrape():
    """Trigger a BrightData scraping job for a LinkedIn profile URL"""
    try:
        # Get auth token from request headers
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing or invalid authorization token"}), 401
        
        token = auth_header.split(' ')[1]
        user_id = get_user_id_from_token(token)
        if not user_id:
            return jsonify({"error": "Invalid token"}), 401

        # Check user credits
        credits = get_user_credits(user_id)
        if credits < 1:
            return jsonify({"error": "Insufficient credits"}), 402

        # Get URL from request
        data = request.get_json()
        linkedin_url = data.get('url')
        if not linkedin_url:
            return jsonify({"error": "Missing LinkedIn URL"}), 400

        # Validate LinkedIn URL
        if 'linkedin.com/in/' not in linkedin_url:
            return jsonify({"error": "Invalid LinkedIn profile URL"}), 400

        # Trigger BrightData scraping job
        bright_data_url = "https://api.brightdata.com/datasets/v3/trigger"
        headers = {
            "Authorization": f"Bearer {BRIGHT_DATA_TOKEN}",
            "Content-Type": "application/json"
        }
        
        params = {
            "dataset_id": BRIGHT_DATA_DATASET_ID,
            "include_errors": "true"
        }
        
        # BrightData expects an array of URLs
        data = [{"url": linkedin_url}]

        response = requests.post(bright_data_url, headers=headers, params=params, json=data)
        
        if not response.ok:
            log_to_file(f"BrightData API error: {response.status_code} - {response.text}")
            return jsonify({"error": "Failed to start scraping job"}), 500

        result = response.json()
        # BrightData trigger returns a snapshot_id
        job_id = result.get("snapshot_id")
        
        if not job_id:
            log_to_file(f"BrightData response: {result}")
            return jsonify({"error": "No job ID returned from BrightData"}), 500

        # Decrement user credits since we started the job
        decrement_user_credits(user_id, 1)
        
        return jsonify({"job_id": job_id, "status": "started"}), 200

    except Exception as e:
        log_to_file(f"Error in trigger_linkedin_scrape: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/scrape-result/<job_id>', methods=['GET'])
def get_scrape_result(job_id):
    """Poll for BrightData scraping results and generate email when complete"""
    try:
        # Get auth token from request headers
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing or invalid authorization token"}), 401
        
        token = auth_header.split(' ')[1]
        user_id = get_user_id_from_token(token)
        if not user_id:
            return jsonify({"error": "Invalid token"}), 401

        # Check BrightData job status
        bright_data_url = f"https://api.brightdata.com/datasets/v3/snapshot/{job_id}"
        headers = {
            "Authorization": f"Bearer {BRIGHT_DATA_TOKEN}"
        }
        
        params = {
            "format": "json"
        }

        response = requests.get(bright_data_url, headers=headers, params=params)
        
        if not response.ok:
            log_to_file(f"BrightData status check error: {response.status_code} - {response.text}")
            return jsonify({"error": "Failed to check job status"}), 500

        result = response.json()
        
        # Check if result is a list (completed data) or dict (status info)
        if isinstance(result, list):
            # Job completed, data returned directly as list
            if result:
                profile_data = result[0]
                log_to_file(f"BrightData job completed, got {len(result)} profiles")
            else:
                return jsonify({"error": "No profile data found"}), 404
        elif isinstance(result, dict):
            # Handle dict response with status
            status = result.get("status")
            
            if status != "completed":
                return jsonify({"status": "pending"}), 200

            # Extract profile data from results
            if not result.get("data") or len(result["data"]) == 0:
                return jsonify({"error": "No profile data found"}), 404

            profile_data = result["data"][0]
        else:
            log_to_file(f"Unexpected BrightData response type: {type(result)}")
            return jsonify({"error": "Unexpected response format"}), 500
        
        # Parse the LinkedIn data into our format
        parsed_profile = parse_brightdata_linkedin(profile_data)
        
        # Generate email using existing pipeline
        email_profiles = [{
            "linkedin": {"raw_text": format_profile_for_email(parsed_profile)},
            "bio_page": {"raw_text": ""},
            "values_page": {"raw_text": ""}
        }]
        
        processed = process_profiles_batch(
            email_profiles,
            generate_email_flag=True,
            generate_subject_flag=True,
            simple_email=False
        )
        
        generated_profile = processed[0]
        
        return jsonify({
            "status": "done",
            "profile": parsed_profile,
            "generated_subject": generated_profile.get("generated_subject", ""),
            "generated_email": generated_profile.get("generated_email", "")
        }), 200

    except Exception as e:
        log_to_file(f"Error in get_scrape_result: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

def parse_brightdata_linkedin(profile_data):
    """Parse BrightData LinkedIn response into structured format"""
    try:
        parsed = {
            "name": profile_data.get("name", ""),
            "headline": profile_data.get("position", ""),  # BrightData uses 'position' not 'headline'
            "about": profile_data.get("about", "") or "",  # Handle null values
            "experiences": [],
            "education": [],
            "location": profile_data.get("city", "")  # BrightData uses 'city' not 'location'
        }
        
        # Parse experiences - BrightData may return null
        experience = profile_data.get("experience")
        if experience and isinstance(experience, list):
            for exp in experience:
                if isinstance(exp, dict):
                    parsed["experiences"].append({
                        "title": exp.get("title", ""),
                        "company": exp.get("company", ""),
                        "duration": exp.get("duration", ""),
                        "description": exp.get("description", "")
                    })
        elif experience and isinstance(experience, dict):
            # Single experience object
            parsed["experiences"].append({
                "title": experience.get("title", ""),
                "company": experience.get("company", ""),
                "duration": experience.get("duration", ""),
                "description": experience.get("description", "")
            })
        
        # Parse education - BrightData structure is different
        education = profile_data.get("education", [])
        if isinstance(education, list):
            for edu in education:
                if isinstance(edu, dict):
                    parsed["education"].append({
                        "school": edu.get("title", ""),  # BrightData uses 'title' for school name
                        "degree": "",  # Not provided in BrightData response
                        "field": "",   # Not provided in BrightData response
                        "years": f"{edu.get('start_year', '')}-{edu.get('end_year', '')}" if edu.get('start_year') or edu.get('end_year') else ""
                    })
        
        return parsed
        
    except Exception as e:
        log_to_file(f"Error parsing LinkedIn data: {str(e)}")
        return {
            "name": "",
            "headline": "",
            "about": "",
            "experiences": [],
            "education": [],
            "location": ""
        }

def format_profile_for_email(parsed_profile):
    """Format parsed LinkedIn profile data for email generation"""
    try:
        formatted = f"Name: {parsed_profile['name']}\n"
        formatted += f"Position: {parsed_profile['headline']}\n"  # Changed from Headline to Position
        
        if parsed_profile['location']:
            formatted += f"Location: {parsed_profile['location']}\n"
        
        if parsed_profile['about']:
            formatted += f"\nAbout:\n{parsed_profile['about']}\n"
        
        if parsed_profile['experiences']:
            formatted += "\nExperience:\n"
            for exp in parsed_profile['experiences'][:3]:  # Limit to top 3 experiences
                formatted += f"• {exp['title']} at {exp['company']}"
                if exp['duration']:
                    formatted += f" ({exp['duration']})"
                formatted += "\n"
                if exp['description']:
                    formatted += f"  {exp['description'][:200]}...\n"
        
        if parsed_profile['education']:
            formatted += "\nEducation:\n"
            for edu in parsed_profile['education'][:2]:  # Limit to top 2 education entries
                school_info = edu['school']
                if edu['years']:
                    school_info += f" ({edu['years']})"
                formatted += f"• {school_info}\n"
        
        return formatted
        
    except Exception as e:
        log_to_file(f"Error formatting profile: {str(e)}")
        return f"Name: {parsed_profile.get('name', '')}\nPosition: {parsed_profile.get('headline', '')}"

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)