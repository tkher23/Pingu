from flask import Flask, request, jsonify
import os
import pandas as pd
from backend import process_profiles_batch, process_profiles_batch_async_wrapper  # Import your processing logic
from flask_cors import CORS
import json
import requests
from stripe_utils import create_checkout_session
import stripe
from datetime import datetime, timedelta
import logging
import sys
import time

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
BRIGHT_DATA_TOKEN = os.getenv("BRIGHT_DATA_TOKEN")
BRIGHT_DATA_DATASET_ID = os.getenv("BRIGHT_DATA_DATASET_ID")
APOLLO_API_KEY = os.getenv("APOLLO_API_KEY")

# Create logs directory if it doesn't exist
if not os.path.exists('logs'):
    os.makedirs('logs')

# --- Consolidated Logging setup - ALL LOGS IN ONE FILE ---
from datetime import datetime

# Clear and setup a single comprehensive log file
log_filename = 'logs/all_logs.log'

# Configure logging to write everything to one file
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(log_filename, mode='a'),  # Append to one file
        logging.StreamHandler(sys.stdout)  # Also show in terminal
    ],
    force=True  # Override any existing handlers
)
# --- End logging setup ---

def log_to_file(msg):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
    formatted_msg = f"[{timestamp}] {msg}"
    
    # Write directly to the consolidated log file with UTF-8 encoding
    try:
        with open('logs/all_logs.log', 'a', encoding='utf-8') as f:
            f.write(formatted_msg + '\n')
            f.flush()
    except UnicodeEncodeError:
        # Fallback: replace problematic characters
        safe_msg = msg.encode('ascii', 'replace').decode('ascii')
        safe_formatted = f"[{timestamp}] {safe_msg}"
        with open('logs/all_logs.log', 'a', encoding='utf-8') as f:
            f.write(safe_formatted + '\n')
            f.flush()
    
    # Also print to console (avoid emoji issues in terminal)
    safe_console_msg = msg.replace('[TIMING]', '[TIMING]').replace('🔗', '[LINK]').replace('❌', '[ERROR]').replace('✅', '[SUCCESS]')
    print(f"[{timestamp}] {safe_console_msg}", flush=True)

def find_emails_with_apollo_bulk(brightdata_profiles):
    """
    Use Apollo Bulk People Enrichment API to find emails for multiple people using BrightData profile info
    
    Args:
        brightdata_profiles (list): List of parsed BrightData profiles
    
    Returns:
        list: List of contact info dicts for each profile
    """
    if not APOLLO_API_KEY:
        log_to_file("Apollo API key not configured for bulk processing")
        return [{"email": None, "phone": None, "apollo_found": False} for _ in brightdata_profiles]
    
    if not brightdata_profiles:
        return []
    
    log_to_file(f"🚀 Starting bulk Apollo enrichment for {len(brightdata_profiles)} profiles")
    
    # Initialize results array
    results = [{"email": None, "phone": None, "apollo_found": False} for _ in brightdata_profiles]
    
    # Process in batches of 10 (Apollo bulk limit)
    for batch_start in range(0, len(brightdata_profiles), 10):
        batch_end = min(batch_start + 10, len(brightdata_profiles))
        batch_profiles = brightdata_profiles[batch_start:batch_end]
        
        # Prepare bulk enrichment request
        apollo_url = "https://api.apollo.io/api/v1/people/bulk_match"
        headers = {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "X-Api-Key": APOLLO_API_KEY
        }
        
        details = []
        for i, profile in enumerate(batch_profiles):
            linkedin_url = profile.get("linkedin_url", "").strip()
            
            log_to_file(f"🔗 Profile {i+1}: LinkedIn URL = '{linkedin_url}'")
            
            if not linkedin_url:
                log_to_file(f"❌ Profile {i+1}: Missing LinkedIn URL")
                details.append({})  # Empty details for profiles without LinkedIn URL
                continue
                
            # Use only LinkedIn URL - this is often the most reliable approach
            person_details = {
                "linkedin_url": linkedin_url
            }
            
            details.append(person_details)
            log_to_file(f"✅ Profile {i+1}: Added to Apollo batch")
        
        if not details or all(not d for d in details):
            log_to_file(f"❌ No valid LinkedIn URLs found in batch")
            continue
        
        payload = {
            "reveal_personal_emails": True,
            "details": details
        }
        
        log_to_file(f"� Apollo bulk enrichment API call:")
        log_to_file(f"   URL: {apollo_url}")
        log_to_file(f"   Payload: {json.dumps(payload, indent=2)}")
        log_to_file(f"   API Key: {APOLLO_API_KEY[:10]}...")
        
        response = requests.post(apollo_url, headers=headers, json=payload)
        
        log_to_file(f"📡 Apollo bulk API response status: {response.status_code}")
        
        if response.ok:
            data = response.json()
            log_to_file(f"� Apollo bulk response data: {json.dumps(data, indent=2)}")
            matches = data.get("matches", [])
            
            log_to_file(f"🔍 Found {len(matches)} matches in Apollo bulk response")
            
            # Map enriched results back to correct positions
            for j, match in enumerate(matches):
                global_index = batch_start + j
                if global_index >= len(results):
                    break
                    
                log_to_file(f"📊 Processing match {j+1}: {json.dumps(match, indent=2) if match else 'None'}")
                    
                if match:
                    # Apollo bulk API returns person data directly, not nested under "person"
                    email = match.get("email")
                    log_to_file(f"📧 Match {j+1} email: '{email}'")
                    
                    if email and email != "email_not_unlocked@domain.com":
                        results[global_index] = {
                            "email": email,
                            "phone": None,
                            "apollo_found": True,
                            "apollo_name": match.get("name"),
                            "apollo_title": match.get("title"),
                            "apollo_company": match.get("organization", {}).get("name") if match.get("organization") else None
                        }
                        profile_name = batch_profiles[j].get("name", "Unknown")
                        log_to_file(f"✅ Bulk found email for {profile_name}: {email}")
                    else:
                        log_to_file(f"❌ Match {j+1}: Invalid email ('{email}')")
                else:
                    log_to_file(f"❌ Match {j+1}: No match data")
        else:
            log_to_file(f"❌ Bulk enrichment API error: {response.status_code} - {response.text}")
    
    success_count = sum(1 for r in results if r.get('apollo_found'))
    log_to_file(f"🎉 Bulk Apollo processing complete. Found emails for {success_count}/{len(results)} profiles")
    return results

def find_email_with_apollo(brightdata_profile):
    """
    Use Apollo People Enrichment API to find email using BrightData profile info
    
    Args:
        brightdata_profile (dict): Parsed BrightData profile with name, company, location, title
    
    Returns:
        dict: Contains email, phone, and other contact info if found
    """
    apollo_start = time.time()
    if not APOLLO_API_KEY:
        log_to_file("Apollo API key not configured")
        return {"email": None, "phone": None, "apollo_found": False}
    
    linkedin_url = brightdata_profile.get("linkedin_url", "").strip()
    
    log_to_file(f"� Using LinkedIn URL for Apollo: '{linkedin_url}'")
    
    if not linkedin_url:
        log_to_file("❌ No LinkedIn URL provided for Apollo enrichment")
        return {"email": None, "phone": None, "apollo_found": False}
    
    try:
        # Step 1: Prepare Apollo request
        request_prep_start = time.time()
        apollo_url = "https://api.apollo.io/api/v1/people/match"
        headers = {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "X-Api-Key": APOLLO_API_KEY
        }
        
        # Build enrichment parameters with just LinkedIn URL
        enrich_params = {
            "linkedin_url": linkedin_url,
            "reveal_personal_emails": True
        }
        
        log_to_file(f"� Apollo enrichment API call with params: {json.dumps(enrich_params, indent=2)}")
        log_to_file(f"🌐 Apollo API URL: {apollo_url}")
        log_to_file(f"🔑 Apollo API Key: {APOLLO_API_KEY[:10]}...")
        log_to_file(f"[TIMING] APOLLO REQUEST PREP took {time.time() - request_prep_start:.2f}s")
        
        # Step 2: Make Apollo API call
        api_call_start = time.time()
        response = requests.post(apollo_url, headers=headers, json=enrich_params)
        log_to_file(f"[TIMING] APOLLO API CALL took {time.time() - api_call_start:.2f}s")
        
        log_to_file(f"📡 Apollo API response status: {response.status_code}")
        
        if not response.ok:
            log_to_file(f"❌ Apollo enrichment API error: {response.status_code} - {response.text}")
            return {"email": None, "phone": None, "apollo_found": False}
        
        # Step 3: Parse Apollo response
        response_parse_start = time.time()
        data = response.json()
        log_to_file(f"📄 Apollo enrichment response data: {json.dumps(data, indent=2)}")
        
        person = data.get("person", {})
        
        if not person:
            log_to_file(f"❌ No person data in Apollo enrichment response")
            return {"email": None, "phone": None, "apollo_found": False}
        
        email = person.get("email")
        log_to_file(f"📧 Extracted email from Apollo: '{email}'")
        log_to_file(f"[TIMING] APOLLO RESPONSE PARSE took {time.time() - response_parse_start:.2f}s")
        
        if email and email != "email_not_unlocked@domain.com":
            log_to_file(f"✅ Apollo found email: {email}")
            result = {
                "email": email,
                "phone": None,
                "apollo_found": True,
                "apollo_name": person.get("name"),
                "apollo_title": person.get("title"),
                "apollo_company": person.get("organization", {}).get("name") if person.get("organization") else None
            }
            log_to_file(f"[TIMING] TOTAL APOLLO ENRICHMENT took {time.time() - apollo_start:.2f}s")
            return result
        else:
            log_to_file(f"❌ No valid email in Apollo enrichment response (got: '{email}')")
            return {"email": None, "phone": None, "apollo_found": False}
            
    except Exception as e:
        log_to_file(f"❌ Error in Apollo enrichment: {str(e)}")
        return {"email": None, "phone": None, "apollo_found": False, "error": str(e)}

def extract_company_domain(company_name):
    """
    Try to guess company domain from company name
    This is a simple heuristic - in practice you might want a more sophisticated approach
    """
    if not company_name:
        return None
    
    # Common mappings for well-known companies
    domain_mappings = {
        "google": "google.com",
        "microsoft": "microsoft.com",
        "apple": "apple.com",
        "amazon": "amazon.com",
        "meta": "meta.com",
        "facebook": "meta.com",
        "netflix": "netflix.com",
        "salesforce": "salesforce.com",
        "oracle": "oracle.com",
        "ibm": "ibm.com",
        "adobe": "adobe.com",
        "linkedin": "linkedin.com",
        "twitter": "twitter.com",
        "uber": "uber.com",
        "airbnb": "airbnb.com",
        "spotify": "spotify.com",
        "tesla": "tesla.com"
    }
    
    company_lower = company_name.lower().strip()
    
    # Check direct mappings first
    for company, domain in domain_mappings.items():
        if company in company_lower:
            return domain
    
    # Simple heuristic: take first word and add .com
    words = company_lower.replace(",", "").replace(".", "").replace("&", "").split()
    if words:
        first_word = words[0]
        # Skip common business words
        skip_words = {"the", "inc", "llc", "corp", "corporation", "company", "co", "ltd", "limited"}
        if first_word not in skip_words and len(first_word) > 2:
            return f"{first_word}.com"
    
    return None

def should_use_apollo_enrichment(user_plan_type):
    """
    Determine if Apollo enrichment should be used based on user plan
    Apollo costs credits, so we may want to limit this to paid plans
    """
    # For now, enable for all plans, but you could restrict to paid plans only
    return True
    
    # Alternative: Only for paid plans
    # return user_plan_type in ["basic", "advanced"]

def is_valid_email(email):
    """Backend email validation"""
    import re
    if not email or not isinstance(email, str):
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def send_email_via_gmail(to_email, subject, body, sender_name, sender_email, user_id):
    """Send email via Gmail API"""
    try:
        # For now, simulate email sending since Gmail API setup is complex
        # In production, this would use Gmail API credentials
        log_to_file(f"📧 Simulating email send to {to_email}")
        log_to_file(f"   From: {sender_name} <{sender_email}>")
        log_to_file(f"   Subject: {subject}")
        log_to_file(f"   Body length: {len(body)} characters")
        
        # Simulate success (in production, this would be actual Gmail API call)
        import random
        import time
        time.sleep(0.1)  # Simulate API delay
        
        # Simulate 95% success rate for testing
        success = random.random() > 0.05
        
        if success:
            message_id = f"gmail_{int(time.time())}_{random.randint(1000, 9999)}"
            log_to_file(f"✅ Email sent successfully to {to_email}: {message_id}")
            return {
                "success": True,
                "message_id": message_id,
                "recipient": to_email
            }
        else:
            log_to_file(f"❌ Simulated email send failure to {to_email}")
            return {
                "success": False,
                "error": "Simulated send failure",
                "recipient": to_email
            }
            
    except Exception as e:
        log_to_file(f"❌ Email send error for {to_email}: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "recipient": to_email
        }

def handle_single_email(user_id, recipient_email, recipient_name, subject, body, sender_name, sender_email):
    """Handle single email with backend validation"""
    log_to_file(f"[TIMING] Single email processing started for {recipient_email}")
    start_time = time.time()
    
    # Validate single email format
    if not is_valid_email(recipient_email):
        log_to_file(f"❌ Invalid email format: {recipient_email}")
        return jsonify({"success": False, "error": "Invalid email format"}), 400
    
    # Check credits
    user_credits = get_user_credits(user_id)
    if user_credits < 1:
        log_to_file(f"❌ Insufficient credits for user {user_id}: {user_credits}")
        return jsonify({"success": False, "error": "Insufficient credits"}), 402
    
    # Send email
    result = send_email_via_gmail(recipient_email, subject, body, sender_name, sender_email, user_id)
    
    if result.get('success'):
        decrement_user_credits(user_id, 1)
        log_to_file(f"[TIMING] Single email completed in {time.time() - start_time:.2f}s")
        return jsonify({
            "success": True,
            "message": "✅ Email sent successfully!"
        })
    else:
        log_to_file(f"❌ Single email send failed: {result.get('error', 'Unknown error')}")
        return jsonify({
            "success": False,
            "error": f"Failed to send email: {result.get('error', 'Unknown error')}"
        }), 500

def handle_multiple_emails(user_id, recipient_emails_str, subject, body, sender_name, sender_email):
    """Handle multiple emails with backend validation and logic"""
    log_to_file(f"[TIMING] Multiple email processing started")
    start_time = time.time()
    
    # Parse and validate emails (BACKEND LOGIC)
    email_list = [email.strip() for email in recipient_emails_str.split(',') if email.strip()]
    
    if not email_list:
        log_to_file(f"❌ No valid emails provided from: {recipient_emails_str}")
        return jsonify({"success": False, "error": "No valid emails provided"}), 400
    
    log_to_file(f"📧 Parsed {len(email_list)} emails: {email_list}")
    
    # Validate all email formats
    invalid_emails = [email for email in email_list if not is_valid_email(email)]
    if invalid_emails:
        log_to_file(f"❌ Invalid email formats: {invalid_emails}")
        return jsonify({
            "success": False,
            "error": f"Invalid email format(s): {', '.join(invalid_emails[:3])}{'...' if len(invalid_emails) > 3 else ''}"
        }), 400
    
    # Check credits
    credits_needed = len(email_list)
    user_credits = get_user_credits(user_id)
    
    if user_credits < credits_needed:
        log_to_file(f"❌ Insufficient credits: need {credits_needed}, have {user_credits}")
        return jsonify({
            "success": False,
            "error": f"Insufficient credits. Need {credits_needed}, have {user_credits}"
        }), 402
    
    # Send emails
    successful_sends = 0
    failed_emails = []
    
    for email in email_list:
        result = send_email_via_gmail(email, subject, body, sender_name, sender_email, user_id)
        if result.get('success'):
            successful_sends += 1
        else:
            failed_emails.append(email)
    
    # Deduct credits only for successful sends
    if successful_sends > 0:
        decrement_user_credits(user_id, successful_sends)
    
    log_to_file(f"[TIMING] Multiple email processing completed in {time.time() - start_time:.2f}s")
    log_to_file(f"📊 Email results: {successful_sends}/{len(email_list)} successful")
    
    # Return smart response
    total_emails = len(email_list)
    if successful_sends == total_emails:
        return jsonify({
            "success": True,
            "message": f"✅ Successfully sent {successful_sends} emails! Used {successful_sends} credits."
        })
    elif successful_sends > 0:
        return jsonify({
            "success": True,
            "message": f"⚠️ Sent {successful_sends}/{total_emails} emails. {len(failed_emails)} failed. Used {successful_sends} credits."
        })
    else:
        return jsonify({
            "success": False,
            "error": "❌ All email sends failed. No credits used."
        }), 500

def calculate_exponential_backoff_delay(status_checks):
    """
    Calculate exponential backoff delay for BrightData polling
    
    Args:
        status_checks (int): Number of status checks already performed
    
    Returns:
        float: Delay in seconds before next check
    """
    # Exponential backoff: 0.5s → 1s → 2s → 4s → 8s → 10s (max)
    base_delays = [0.5, 1.0, 2.0, 4.0, 8.0]
    max_delay = 10.0
    
    if status_checks < len(base_delays):
        return base_delays[status_checks]
    else:
        return max_delay

def get_next_poll_time(job_metadata):
    """
    Calculate when the next poll should happen based on exponential backoff
    
    Args:
        job_metadata (dict): Job metadata containing last_poll_time and status_checks
    
    Returns:
        float: Timestamp when next poll should happen, or 0 if ready to poll now
    """
    last_poll_time = job_metadata.get('last_poll_time', 0)
    status_checks = job_metadata.get('status_checks', 0)
    
    if last_poll_time == 0:
        return 0  # First poll, ready immediately
    
    delay = calculate_exponential_backoff_delay(status_checks - 1)  # -1 because we increment after calculation
    next_poll_time = last_poll_time + delay
    current_time = time.time()
    
    if current_time >= next_poll_time:
        return 0  # Ready to poll now
    else:
        return next_poll_time  # Return when next poll should happen

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# In-memory storage for batch job metadata
batch_job_metadata = {}

def get_user_credits(user_id):
    # For local testing - return test credits
    if user_id == "test_user_id":
        return 100
        
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
    # For local testing - bypass auth with test token
    if token == "test_token_local_dev":
        return "test_user_id"
    
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
    start_time = time.time()
    try:
        # Step 1: Authentication
        auth_start = time.time()
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        user_id = get_user_id_from_token(token)
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401
        log_to_file(f"[TIMING] AUTH took {time.time() - auth_start:.2f}s")
        
        # Step 2: Initialize trial
        trial_start = time.time()
        initialize_trial_if_needed(user_id)
        log_to_file(f"[TIMING] TRIAL INIT took {time.time() - trial_start:.2f}s")
        
        # Step 3: Check user profile and credits
        profile_check_start = time.time()
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
        log_to_file(f"[TIMING] PROFILE CHECK took {time.time() - profile_check_start:.2f}s")
        
        # Step 4: Access control validation
        validation_start = time.time()
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
        log_to_file(f"[TIMING] VALIDATION took {time.time() - validation_start:.2f}s")
        
        # Step 5: Parse request data
        data_parse_start = time.time()
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
        log_to_file(f"[TIMING] DATA PARSE took {time.time() - data_parse_start:.2f}s")
        
        # Step 6: Process profile batch (email generation)
        processing_start = time.time()
        processed = process_profiles_batch_async_wrapper([profile], generate_email_flag=True, generate_subject_flag=False)
        log_to_file(f"[TIMING] EMAIL PROCESSING took {time.time() - processing_start:.2f}s")
        
        # Step 7: Decrement credits
        credit_start = time.time()
        decrement_user_credits(user_id, amount=2)  # Use 2 credits for advanced email
        log_to_file(f"[TIMING] CREDIT DECREMENT took {time.time() - credit_start:.2f}s")
        
        log_to_file(f"[TIMING] TOTAL SINGLE PROFILE PROCESSING took {time.time() - start_time:.2f}s")
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

        processed = process_profiles_batch_async_wrapper([profile], generate_email_flag=False, generate_subject_flag=True)
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

        # GET THE RECIPIENT EMAILS AND COUNT THEM
        recipient_emails = data.get("recipient_emails", "").strip()
        if not recipient_emails:
            return jsonify({"error": "Missing recipient emails"}), 400

        # Parse and count recipients
        email_list = [email.strip() for email in recipient_emails.split(',') if email.strip()]
        num_recipients = len(email_list)
        
        # Validate max 50 recipients
        if num_recipients > 50:
            return jsonify({"error": f"Too many recipients. Maximum 50 allowed, you provided {num_recipients} recipients."}), 400

        # Check credits based on number of recipients
        if user_credits < num_recipients:
            return jsonify({"error": f"Insufficient credits. Need {num_recipients} credits for {num_recipients} recipients, have {user_credits}"}), 402

        profile = {
            "internship_interest": data.get("internship_interest", ""),
            "user_info": data.get("user_info", {}),
            "recipient_name": data.get("recipient_name", ""),
            "company_of_interest": data.get("user_info", {}).get("company_interest", ""),
        }

        processed = process_profiles_batch_async_wrapper([profile], generate_email_flag=True, generate_subject_flag=False, simple_email=True)

        # CHARGE CREDITS BASED ON NUMBER OF RECIPIENTS
        decrement_user_credits(user_id, amount=num_recipients)
        
        log_to_file(f"✅ Simple email generated for {num_recipients} recipients, charged {num_recipients} credits")
        return jsonify(processed[0]), 200

    except Exception as e:
        print("❌ Simple Email ERROR:", e)
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route('/api/send-email-smart', methods=['POST'])
def send_email_smart():
    """Single endpoint that handles both single and multiple emails intelligently"""
    try:
        # Get user_id from authorization header (following existing auth pattern)
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        user_id = get_user_id_from_token(token)
        if not user_id:
            return jsonify({"success": False, "error": "Unauthorized"}), 401
        
        data = request.json
        mode = data.get('mode', 'single')  # 'single' or 'multiple'
        recipient_emails = data.get('recipient_emails', '').strip()
        recipient_name = data.get('recipient_name', '').strip()
        subject = data.get('subject', '').strip()
        body = data.get('body', '').strip()
        sender_name = data.get('sender_name', '')
        sender_email = data.get('sender_email', '')
        
        log_to_file(f"[TIMING] Smart email endpoint called: mode={mode}, user_id={user_id}")
        
        # Backend validation
        if not all([recipient_emails, subject, body]):
            return jsonify({"success": False, "error": "Missing required fields"}), 400
        
        if mode == 'single':
            if not recipient_name:
                return jsonify({"success": False, "error": "Recipient name required for single emails"}), 400
            return handle_single_email(user_id, recipient_emails, recipient_name, subject, body, sender_name, sender_email)
        else:
            return handle_multiple_emails(user_id, recipient_emails, subject, body, sender_name, sender_email)
            
    except Exception as e:
        log_to_file(f"Error in send_email_smart: {str(e)}")
        return jsonify({"success": False, "error": "Server error"}), 500

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
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401
        data = request.get_json()
        plan = data.get("plan")  # 'basic' or 'advanced'
        success_url = data.get("success_url")
        cancel_url = data.get("cancel_url")
        # Fetch user email and stripe_customer_id from Supabase
        url = f"{SUPABASE_URL}/rest/v1/user_profiles?id=eq.{user_id}&select=email,stripe_customer_id"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
        }
        response = requests.get(url, headers=headers)
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
@app.route('/api/scrape-linkedin-batch', methods=['POST'])
def trigger_linkedin_batch_scrape():
    """Trigger a BrightData scraping job for multiple LinkedIn profile URLs"""
    try:
        # Get auth token from request headers
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing or invalid authorization token"}), 401
        
        token = auth_header.split(' ')[1]
        user_id = get_user_id_from_token(token)
        if not user_id:
            return jsonify({"error": "Invalid token"}), 401

        # Get URLs and additional info from request
        data = request.get_json()
        urls_data = data.get('urls', [])
        
        # Handle both old format (array of strings) and new format (array of objects)
        if urls_data and isinstance(urls_data[0], str):
            # Old format - convert to new format
            linkedin_urls = urls_data
            urls_with_info = [{"url": url, "additional_info": "", "company_info": ""} for url in urls_data]
        else:
            # New format
            urls_with_info = urls_data
            linkedin_urls = [item.get("url", "") for item in urls_data]
        
        if not linkedin_urls or not isinstance(linkedin_urls, list):
            return jsonify({"error": "Missing or invalid LinkedIn URLs array"}), 400

        if len(linkedin_urls) > 10:  # Limit batch size
            return jsonify({"error": "Maximum 10 URLs per batch"}), 400

        # Check user credits (2 credits per URL for BrightData processing)
        credits = get_user_credits(user_id)
        if credits < len(linkedin_urls) * 2:
            return jsonify({"error": f"Insufficient credits. Need {len(linkedin_urls) * 2}, have {credits}"}), 402

        # Validate all LinkedIn URLs
        invalid_urls = []
        for url in linkedin_urls:
            if not url or 'linkedin.com/in/' not in url:
                invalid_urls.append(url)
        
        if invalid_urls:
            return jsonify({"error": f"Invalid LinkedIn URLs: {invalid_urls}"}), 400

        # Store metadata for this batch job
        batch_metadata = {
            'urls_with_info': urls_with_info,
            'original_linkedin_urls': linkedin_urls,  # Store original URLs for Apollo enrichment
            'user_id': user_id,
            'started_at': datetime.utcnow().isoformat(),
            'status_checks': 0,
            'max_status_checks': 30,  # Maximum number of status checks allowed
            'timeout_minutes': 10,    # Job timeout in minutes
            'last_poll_time': 0       # Track last poll time for exponential backoff
        }

        # Trigger BrightData batch scraping job
        bright_data_url = "https://api.brightdata.com/datasets/v3/trigger"
        headers = {
            "Authorization": f"Bearer {BRIGHT_DATA_TOKEN}",
            "Content-Type": "application/json"
        }
        
        params = {
            "dataset_id": BRIGHT_DATA_DATASET_ID,
            "include_errors": "true",
            "custom_output_fields": "url|name|position|about|experience|education|projects|publications"
        }
        
        # BrightData expects an array of URLs
        batch_data = [{"url": url} for url in linkedin_urls]

        response = requests.post(bright_data_url, headers=headers, params=params, json=batch_data)
        
        if not response.ok:
            log_to_file(f"BrightData batch API error: {response.status_code} - {response.text}")
            return jsonify({"error": "Failed to start batch scraping job"}), 500

        result = response.json()
        job_id = result.get("snapshot_id")
        
        if not job_id:
            log_to_file(f"BrightData batch response: {result}")
            return jsonify({"error": "No job ID returned from BrightData"}), 500

        # Store batch metadata for this job
        batch_job_metadata[job_id] = batch_metadata

        # Decrement user credits for all URLs (2 credits per profile)
        decrement_user_credits(user_id, len(linkedin_urls) * 2)
        
        return jsonify({
            "job_id": job_id, 
            "status": "started",
            "url_count": len(linkedin_urls),
            "urls": linkedin_urls
        }), 200

    except Exception as e:
        log_to_file(f"Error in trigger_linkedin_batch_scrape: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

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

        # Check user credits (2 credits for BrightData processing)
        credits = get_user_credits(user_id)
        if credits < 2:
            return jsonify({"error": "Insufficient credits. Need 2 credits for LinkedIn profile processing"}), 402

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
            "include_errors": "true",
            "custom_output_fields": "url|name|position|about|experience|education|projects|publications"
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

        # Store metadata for this single job - IMPORTANT: Store original LinkedIn URL
        batch_job_metadata[job_id] = {
            'original_linkedin_url': linkedin_url,
            'user_id': user_id,
            'started_at': datetime.utcnow().isoformat(),
            'status_checks': 0,
            'max_status_checks': 30,  # Maximum number of status checks allowed
            'timeout_minutes': 10,    # Job timeout in minutes
            'last_poll_time': 0       # Track last poll time for exponential backoff
        }

        # Decrement user credits since we started the job (2 credits for BrightData processing)
        decrement_user_credits(user_id, 2)
        
        return jsonify({"job_id": job_id, "status": "started"}), 200

    except Exception as e:
        log_to_file(f"Error in trigger_linkedin_scrape: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/scrape-batch-result/<job_id>', methods=['GET'])
def get_batch_scrape_result(job_id):
    """Poll for BrightData batch scraping results and generate emails when complete"""
    start_time = time.time()
    log_to_file(f"[TIMING] BATCH PROCESSING started for job_id: {job_id}")
    
    try:
        # Get auth token from request headers
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing or invalid authorization token"}), 401
        
        token = auth_header.split(' ')[1]
        user_id = get_user_id_from_token(token)
        if not user_id:
            return jsonify({"error": "Invalid token"}), 401

        # Get stored metadata for this batch job
        batch_metadata = batch_job_metadata.get(job_id, {})
        if not batch_metadata:
            return jsonify({"error": "Job not found or expired"}), 404
        
        # Verify job belongs to this user
        if batch_metadata.get('user_id') != user_id:
            return jsonify({"error": "Unauthorized access to job"}), 403
        
        # Check job timeout (only if we have started_at)
        started_at_str = batch_metadata.get('started_at')
        timeout_minutes = batch_metadata.get('timeout_minutes', 10)
        elapsed = None
        if started_at_str:
            try:
                started_at = datetime.fromisoformat(started_at_str)
                elapsed = datetime.utcnow() - started_at
                if elapsed.total_seconds() > (timeout_minutes * 60):
                    # Job has timed out - clean up and return error
                    if job_id in batch_job_metadata:
                        del batch_job_metadata[job_id]
                    return jsonify({"error": f"Job timed out after {timeout_minutes} minutes. Please try again."}), 408
            except Exception:
                # If datetime parsing fails, don't timeout
                elapsed = None
        
        # Check status check limits
        status_checks = batch_metadata.get('status_checks', 0)
        max_status_checks = batch_metadata.get('max_status_checks', 30)
        if status_checks >= max_status_checks:
            # Too many status checks - clean up and return error
            if job_id in batch_job_metadata:
                del batch_job_metadata[job_id]
            return jsonify({"error": f"Maximum status checks ({max_status_checks}) exceeded. Please try again."}), 429
        
        # Check if enough time has passed for next poll (exponential backoff)
        next_poll_time = get_next_poll_time(batch_metadata)
        if next_poll_time > 0:
            current_time = time.time()
            wait_seconds = max(0, next_poll_time - current_time)
            log_to_file(f"[TIMING] EXPONENTIAL BACKOFF: Need to wait {wait_seconds:.1f}s before next poll")
            return jsonify({
                "status": "pending",
                "message": "Exponential backoff - please wait before next poll",
                "wait_seconds": round(wait_seconds, 1),
                "checks_remaining": max_status_checks - status_checks,
                "elapsed_minutes": round(elapsed.total_seconds() / 60, 1) if started_at_str else 0,
                "timeout_minutes": timeout_minutes
            }), 200
        
        # Increment status check counter and update last poll time
        batch_job_metadata[job_id]['status_checks'] = status_checks + 1
        batch_job_metadata[job_id]['last_poll_time'] = time.time()

        # Check BrightData job status
        brightdata_start = time.time()
        log_to_file(f"[TIMING] BRIGHTDATA BATCH CHECK started")
        
        bright_data_url = f"https://api.brightdata.com/datasets/v3/snapshot/{job_id}"
        headers = {
            "Authorization": f"Bearer {BRIGHT_DATA_TOKEN}"
        }
        
        params = {
            "format": "json"
        }

        response = requests.get(bright_data_url, headers=headers, params=params)
        
        brightdata_time = time.time() - brightdata_start
        log_to_file(f"[TIMING] BRIGHTDATA BATCH CHECK completed in {brightdata_time:.2f}s")
        
        if not response.ok:
            log_to_file(f"BrightData batch status check error: {response.status_code} - {response.text}")
            return jsonify({"error": "Failed to check job status"}), 500

        result = response.json()
        
        # Check if result is a list (completed data) or dict (status info)
        if isinstance(result, list):
            # Job completed, data returned directly as list
            if result:
                profiles_data = result
                log_to_file(f"BrightData batch job completed, got {len(result)} profiles")
            else:
                return jsonify({"error": "No profile data found"}), 404
        elif isinstance(result, dict):
            # Handle dict response with status
            status = result.get("status")
            
            if status != "completed":
                return jsonify({
                    "status": "pending",
                    "checks_remaining": max_status_checks - status_checks,
                    "elapsed_minutes": round(elapsed.total_seconds() / 60, 1) if started_at_str else 0,
                    "timeout_minutes": timeout_minutes
                }), 200

            # Extract profile data from results
            if not result.get("data") or len(result["data"]) == 0:
                return jsonify({"error": "No profile data found"}), 404

            profiles_data = result["data"]
        else:
            log_to_file(f"Unexpected BrightData batch response type: {type(result)}")
            return jsonify({"error": "Unexpected response format"}), 500
        
        # Fetch user profile settings once for all emails
        user_settings_start = time.time()
        log_to_file(f"[TIMING] USER SETTINGS FETCH started")
        
        user_settings_url = f"{SUPABASE_URL}/rest/v1/user_settings?id=eq.{user_id}"
        user_settings_headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
        }
        user_settings_response = requests.get(user_settings_url, headers=user_settings_headers)
        
        user_settings_time = time.time() - user_settings_start
        log_to_file(f"[TIMING] USER SETTINGS FETCH completed in {user_settings_time:.2f}s")
        
        user_info = {}
        if user_settings_response.ok and user_settings_response.json():
            user_settings = user_settings_response.json()[0]
            user_info = {
                "name": user_settings.get("name", ""),
                "intro": user_settings.get("intro", ""),
                "persona_context": user_settings.get("persona_context", ""),
                "company_interest": user_settings.get("company_interest", ""),
                "role_type": user_settings.get("role_type", "internship"),
                "default_interest": user_settings.get("default_interest", "")
            }
        
        # Get batch metadata from validation above
        urls_with_info = batch_metadata.get('urls_with_info', [])
        original_linkedin_urls = batch_metadata.get('original_linkedin_urls', [])
        
        # Check user plan for Apollo enrichment
        user_plan_url = f"{SUPABASE_URL}/rest/v1/user_profiles?id=eq.{user_id}&select=plan_type"
        user_plan_response = requests.get(user_plan_url, headers=user_settings_headers)
        user_plan_type = "trial"  # Default
        if user_plan_response.ok and user_plan_response.json():
            user_plan_type = user_plan_response.json()[0].get("plan_type", "trial")
        
        # Process each profile and generate emails
        processed_profiles = []
        
        # Parse all profiles first
        parsed_profiles = []
        skipped_profiles = []
        
        for i, profile_data in enumerate(profiles_data):
            # Validate profile size before processing
            is_valid, validation_message = validate_profile_size(profile_data)
            
            if not is_valid:
                log_to_file(f"❌ Skipping profile {i+1}: {validation_message}")
                skipped_profiles.append({
                    "index": i,
                    "url": profile_data.get("url", "Unknown"),
                    "reason": validation_message
                })
                # Add empty parsed profile to maintain index alignment
                parsed_profiles.append({
                    "name": "Profile Too Large",
                    "headline": "Could not process",
                    "about": validation_message,
                    "experiences": [],
                    "education": [],
                    "projects": [],
                    "publications": [],
                    "current_company": "",
                    "current_title": ""
                })
                continue
            
            parsed_profile = parse_brightdata_linkedin(profile_data)
            parsed_profiles.append(parsed_profile)
        
        # Use bulk Apollo enrichment with ORIGINAL URLs (not from BrightData)
        apollo_start = time.time()
        apollo_results_by_url = {}  # Map results by URL for accurate matching
        if should_use_apollo_enrichment(user_plan_type) and original_linkedin_urls:
            log_to_file(f"[TIMING] APOLLO BULK ENRICHMENT started for {len(original_linkedin_urls)} URLs")
            log_to_file(f"🔗 Using {len(original_linkedin_urls)} ORIGINAL LinkedIn URLs for bulk Apollo enrichment")
            log_to_file(f"🔗 Original URLs: {original_linkedin_urls}")
            # Create enrichment profiles with original URLs
            enrichment_profiles = [{"linkedin_url": url} for url in original_linkedin_urls]
            apollo_results = find_emails_with_apollo_bulk(enrichment_profiles)
            
            # Map Apollo results by URL to avoid index mismatch issues
            for i, url in enumerate(original_linkedin_urls):
                if i < len(apollo_results):
                    apollo_results_by_url[url] = apollo_results[i]
                    log_to_file(f"🔗 Mapped Apollo result for {url}: {apollo_results[i].get('email', 'No email')}")
                else:
                    apollo_results_by_url[url] = {"email": None, "phone": None, "apollo_found": False}
        else:
            log_to_file(f"[TIMING] APOLLO BULK ENRICHMENT skipped (plan: {user_plan_type})")
        
        apollo_time = time.time() - apollo_start
        log_to_file(f"[TIMING] APOLLO BULK ENRICHMENT completed in {apollo_time:.2f}s")
        
        # Start email generation timing
        email_generation_start = time.time()
        log_to_file(f"[TIMING] EMAIL GENERATION started for {len(profiles_data)} profiles")
        
        for i, profile_data in enumerate(profiles_data):
            parsed_profile = parsed_profiles[i]
            
            # Find Apollo result by matching URL instead of using index
            profile_url = profile_data.get("url", "")
            apollo_result = {"email": None, "phone": None, "apollo_found": False}
            
            # Try to find matching Apollo result by URL
            if profile_url and apollo_results_by_url:
                # Try exact match first
                if profile_url in apollo_results_by_url:
                    apollo_result = apollo_results_by_url[profile_url]
                    log_to_file(f"✅ Exact URL match found for {profile_url}: {apollo_result.get('email', 'No email')}")
                else:
                    # Try to find by URL normalization (remove trailing slashes, etc.)
                    normalized_profile_url = profile_url.rstrip('/')
                    for orig_url, apollo_data in apollo_results_by_url.items():
                        normalized_orig_url = orig_url.rstrip('/')
                        if normalized_profile_url == normalized_orig_url:
                            apollo_result = apollo_data
                            log_to_file(f"✅ Normalized URL match found: {profile_url} → {orig_url}: {apollo_result.get('email', 'No email')}")
                            break
                    else:
                        log_to_file(f"❌ No Apollo result found for profile URL: {profile_url}")
                        log_to_file(f"❌ Available Apollo URLs: {list(apollo_results_by_url.keys())}")
            
            # Add Apollo results to parsed profile
            parsed_profile["apollo_email"] = apollo_result.get("email")
            parsed_profile["apollo_phone"] = apollo_result.get("phone")
            parsed_profile["apollo_found"] = apollo_result.get("apollo_found", False)
            
            # Find the corresponding URL info
            profile_url = profile_data.get("url", "")
            url_info = None
            for url_data in urls_with_info:
                if url_data.get("url") == profile_url:
                    url_info = url_data
                    break
            
            # Default to empty if no URL info found
            if not url_info:
                url_info = {"additional_info": "", "company_info": ""}
            
            # Generate email for this profile with specific additional info
            email_profiles = [{
                "linkedin": {"raw_text": format_profile_for_email(parsed_profile)},
                "bio_page": {"raw_text": url_info.get("additional_info", "")},
                "values_page": {"raw_text": url_info.get("company_info", "")},
                "internship_interest": user_info.get("default_interest", ""),
                "user_info": user_info,
                "recipient_name": parsed_profile.get("name", ""),
                "company_of_interest": user_info.get("company_interest", ""),
                "role_type": user_info.get("role_type", "internship")
            }]
            
            processed = process_profiles_batch_async_wrapper(
                email_profiles,
                generate_email_flag=True,
                generate_subject_flag=True,
                simple_email=False
            )
            
            generated_profile = processed[0]
            
            processed_profiles.append({
                "profile": parsed_profile,
                "generated_subject": generated_profile.get("generated_subject", ""),
                "generated_email": generated_profile.get("generated_email", ""),
                "url": profile_data.get("url", ""),  # Include original URL for reference
                "apollo_email": parsed_profile.get("apollo_email"),
                "apollo_phone": parsed_profile.get("apollo_phone"),
                "apollo_found": parsed_profile.get("apollo_found", False)
            })
        
        # Clean up batch metadata
        if job_id in batch_job_metadata:
            del batch_job_metadata[job_id]
        
        email_generation_time = time.time() - email_generation_start
        total_time = time.time() - start_time
        log_to_file(f"[TIMING] EMAIL GENERATION completed in {email_generation_time:.2f}s")
        log_to_file(f"[TIMING] TOTAL BATCH PROCESSING completed in {total_time:.2f}s")
        
        # Prepare response with information about skipped profiles
        response_data = {
            "status": "done",
            "profiles": processed_profiles,
            "count": len(processed_profiles),
            "total_requested": len(profiles_data)
        }
        
        # Add information about skipped profiles if any
        if skipped_profiles:
            response_data["skipped_profiles"] = skipped_profiles
            response_data["skipped_count"] = len(skipped_profiles)
            log_to_file(f"⚠️ Batch processing completed with {len(skipped_profiles)} skipped profiles")
        
        return jsonify(response_data), 200

    except Exception as e:
        log_to_file(f"Error in get_batch_scrape_result: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/scrape-result/<job_id>', methods=['POST'])
def get_scrape_result(job_id):
    """Poll for BrightData scraping results and generate email when complete"""
    start_time = time.time()
    try:
        # Step 1: Authentication
        auth_start = time.time()
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing or invalid authorization token"}), 401
        
        token = auth_header.split(' ')[1]
        user_id = get_user_id_from_token(token)
        if not user_id:
            return jsonify({"error": "Invalid token"}), 401
        log_to_file(f"[TIMING] SCRAPE AUTH took {time.time() - auth_start:.2f}s")

        # Step 2: Job validation
        job_validation_start = time.time()
        job_metadata = batch_job_metadata.get(job_id, {})
        if not job_metadata:
            return jsonify({"error": "Job not found or expired"}), 404
        
        # Verify job belongs to this user
        if job_metadata.get('user_id') != user_id:
            return jsonify({"error": "Unauthorized access to job"}), 403
        
        # Check job timeout (optimized)
        started_at_str = job_metadata.get('started_at')
        timeout_minutes = job_metadata.get('timeout_minutes', 10)
        elapsed = None
        if started_at_str:
            try:
                started_at = datetime.fromisoformat(started_at_str)
                elapsed = datetime.utcnow() - started_at
                if elapsed.total_seconds() > (timeout_minutes * 60):
                    # Job has timed out - clean up and return error
                    if job_id in batch_job_metadata:
                        del batch_job_metadata[job_id]
                    return jsonify({"error": f"Job timed out after {timeout_minutes} minutes. Please try again."}), 408
            except Exception:
                # If datetime parsing fails, don't timeout
                elapsed = None
        
        # Check status check limits
        status_checks = job_metadata.get('status_checks', 0)
        max_status_checks = job_metadata.get('max_status_checks', 30)
        if status_checks >= max_status_checks:
            # Too many status checks - clean up and return error
            if job_id in batch_job_metadata:
                del batch_job_metadata[job_id]
            return jsonify({"error": f"Maximum status checks ({max_status_checks}) exceeded. Please try again."}), 429
        
        # Check if enough time has passed for next poll (exponential backoff)
        next_poll_time = get_next_poll_time(job_metadata)
        if next_poll_time > 0:
            current_time = time.time()
            wait_seconds = max(0, next_poll_time - current_time)
            log_to_file(f"[TIMING] EXPONENTIAL BACKOFF: Need to wait {wait_seconds:.1f}s before next poll")
            return jsonify({
                "status": "pending",
                "message": "Exponential backoff - please wait before next poll",
                "wait_seconds": round(wait_seconds, 1),
                "checks_remaining": max_status_checks - status_checks,
                "elapsed_minutes": round(elapsed.total_seconds() / 60, 1) if started_at_str else 0,
                "timeout_minutes": timeout_minutes
            }), 200
        
        # Increment status check counter and update last poll time
        batch_job_metadata[job_id]['status_checks'] = status_checks + 1
        batch_job_metadata[job_id]['last_poll_time'] = time.time()
        log_to_file(f"[TIMING] JOB VALIDATION took {time.time() - job_validation_start:.2f}s")

        # Step 3: Parse request data
        data_parse_start = time.time()
        data = request.get_json() or {}
        company_info = data.get('company_info', '')
        recipient_bio = data.get('recipient_bio', '')
        log_to_file(f"[TIMING] DATA PARSE took {time.time() - data_parse_start:.2f}s")

        # Step 4: Check BrightData status
        brightdata_check_start = time.time()
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
        log_to_file(f"[TIMING] BRIGHTDATA CHECK took {time.time() - brightdata_check_start:.2f}s")
        
        # Step 5: Process BrightData result
        result_processing_start = time.time()
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
                return jsonify({
                    "status": "pending",
                    "checks_remaining": max_status_checks - status_checks,
                    "elapsed_minutes": round(elapsed.total_seconds() / 60, 1) if started_at_str else 0,
                    "timeout_minutes": timeout_minutes
                }), 200

            # Extract profile data from results
            if not result.get("data") or len(result["data"]) == 0:
                return jsonify({"error": "No profile data found"}), 404

            profile_data = result["data"][0]
        else:
            log_to_file(f"Unexpected BrightData response type: {type(result)}")
            return jsonify({"error": "Unexpected response format"}), 500
        log_to_file(f"[TIMING] RESULT PROCESSING took {time.time() - result_processing_start:.2f}s")
        
        # Step 6: Validate profile size
        validation_start = time.time()
        is_valid, validation_message = validate_profile_size(profile_data)
        
        if not is_valid:
            log_to_file(f"❌ Single profile processing failed: {validation_message}")
            return jsonify({"error": f"Profile too large to process: {validation_message}"}), 413  # 413 = Payload Too Large
        log_to_file(f"[TIMING] PROFILE VALIDATION took {time.time() - validation_start:.2f}s")
        
        # Step 7: Parse LinkedIn profile
        parsing_start = time.time()
        parsed_profile = parse_brightdata_linkedin(profile_data)
        log_to_file(f"[TIMING] PROFILE PARSING took {time.time() - parsing_start:.2f}s")
        
        # Step 8: Apollo enrichment
        apollo_start = time.time()
        original_linkedin_url = job_metadata.get('original_linkedin_url', '')
        log_to_file(f"🔗 Using ORIGINAL LinkedIn URL for Apollo: '{original_linkedin_url}'")
        
        # Try to find email using Apollo with ORIGINAL LinkedIn URL (not from BrightData response)
        apollo_result = {"email": None, "phone": None, "apollo_found": False}
        if should_use_apollo_enrichment("advanced") and original_linkedin_url:  # Default to advanced plan behavior
            # Create enrichment profile with original URL
            enrichment_profile = {"linkedin_url": original_linkedin_url}
            apollo_result = find_email_with_apollo(enrichment_profile)
        
        # Add Apollo results to parsed profile
        parsed_profile["apollo_email"] = apollo_result.get("email")
        parsed_profile["apollo_phone"] = apollo_result.get("phone")
        parsed_profile["apollo_found"] = apollo_result.get("apollo_found", False)
        log_to_file(f"[TIMING] APOLLO ENRICHMENT took {time.time() - apollo_start:.2f}s")
        
        # Step 9: Fetch user settings
        user_settings_start = time.time()
        user_settings_url = f"{SUPABASE_URL}/rest/v1/user_settings?id=eq.{user_id}"
        user_settings_headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
        }
        user_settings_response = requests.get(user_settings_url, headers=user_settings_headers)
        
        user_info = {}
        if user_settings_response.ok and user_settings_response.json():
            user_settings = user_settings_response.json()[0]
            user_info = {
                "name": user_settings.get("name", ""),
                "intro": user_settings.get("intro", ""),
                "persona_context": user_settings.get("persona_context", ""),
                "company_interest": user_settings.get("company_interest", ""),
                "role_type": user_settings.get("role_type", "internship"),
                "default_interest": user_settings.get("default_interest", "")
            }
        log_to_file(f"[TIMING] USER SETTINGS FETCH took {time.time() - user_settings_start:.2f}s")
        
        # Step 10: Generate email
        email_generation_start = time.time()
        # Generate email using existing pipeline with user context, company info, and recipient bio
        email_profiles = [{
            "linkedin": {"raw_text": format_profile_for_email(parsed_profile)},
            "bio_page": {"raw_text": recipient_bio},  # Use recipient bio as bio_page
            "values_page": {"raw_text": company_info},  # Use company info as values_page
            "internship_interest": user_info.get("default_interest", ""),
            "user_info": user_info,
            "recipient_name": parsed_profile.get("name", ""),
            "company_of_interest": user_info.get("company_interest", ""),
            "role_type": user_info.get("role_type", "internship")
        }]
        
        processed = process_profiles_batch_async_wrapper(
            email_profiles,
            generate_email_flag=True,
            generate_subject_flag=True,
            simple_email=False
        )
        
        generated_profile = processed[0]
        log_to_file(f"[TIMING] EMAIL GENERATION took {time.time() - email_generation_start:.2f}s")
        
        # Clean up job metadata
        if job_id in batch_job_metadata:
            del batch_job_metadata[job_id]
        
        log_to_file(f"[TIMING] TOTAL SCRAPE RESULT PROCESSING took {time.time() - start_time:.2f}s")
        return jsonify({
            "status": "done",
            "profile": parsed_profile,
            "generated_subject": generated_profile.get("generated_subject", ""),
            "generated_email": generated_profile.get("generated_email", ""),
            "apollo_email": parsed_profile.get("apollo_email"),
            "apollo_phone": parsed_profile.get("apollo_phone"),
            "apollo_found": parsed_profile.get("apollo_found", False)
        }), 200

    except Exception as e:
        log_to_file(f"Error in get_scrape_result: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

def parse_brightdata_linkedin(profile_data):
    """Parse BrightData LinkedIn response into structured format with size limits"""
    try:
        # Define size limits to prevent performance issues
        MAX_TEXT_LENGTH = 2000  # Maximum length for text fields like about/description
        MAX_EXPERIENCES = 5     # Maximum number of experiences to process
        MAX_EDUCATION = 3       # Maximum number of education entries
        MAX_PROJECTS = 3        # Maximum number of projects
        MAX_PUBLICATIONS = 2    # Maximum number of publications
        MAX_DESCRIPTION_LENGTH = 300  # Max length for individual descriptions
        
        def truncate_text(text, max_length):
            """Safely truncate text to max length"""
            if not text or not isinstance(text, str):
                return ""
            if len(text) <= max_length:
                return text
            return text[:max_length].rsplit(' ', 1)[0] + "..."
        
        parsed = {
            "name": truncate_text(profile_data.get("name", ""), 100),
            "headline": truncate_text(profile_data.get("position", ""), 200),
            "about": truncate_text(profile_data.get("about", "") or "", MAX_TEXT_LENGTH),
            "location": truncate_text(profile_data.get("location", ""), 100),
            # NOTE: linkedin_url is now stored in job metadata, not from BrightData response
            "experiences": [],
            "education": [],
            "projects": [],
            "publications": [],
            "current_company": "",
            "current_title": ""
        }
        
        # Parse experiences - BrightData may return null
        experience = profile_data.get("experience")
        log_to_file(f"DEBUG: Raw experience data: {experience}")
        log_to_file(f"DEBUG: Experience type: {type(experience)}")
        
        if experience and isinstance(experience, list):
            log_to_file(f"DEBUG: Processing {len(experience)} experiences (limiting to {MAX_EXPERIENCES})")
            # Limit the number of experiences processed
            limited_experiences = experience[:MAX_EXPERIENCES]
            for i, exp in enumerate(limited_experiences):
                log_to_file(f"DEBUG: Experience {i}: {exp}")
                if isinstance(exp, dict):
                    exp_data = {
                        "title": truncate_text(exp.get("title", ""), 150),
                        "company": truncate_text(exp.get("company", ""), 100),
                        "duration": truncate_text(exp.get("duration", ""), 50),
                        "description": truncate_text(exp.get("description", ""), MAX_DESCRIPTION_LENGTH)
                    }
                    parsed["experiences"].append(exp_data)
                    
                    # Get current job info (first experience is usually current)
                    if i == 0:
                        parsed["current_title"] = exp_data["title"]
                        parsed["current_company"] = exp_data["company"]
                        
        elif experience and isinstance(experience, dict):
            # Single experience object
            log_to_file(f"DEBUG: Processing single experience: {experience}")
            exp_data = {
                "title": truncate_text(experience.get("title", ""), 150),
                "company": truncate_text(experience.get("company", ""), 100),
                "duration": truncate_text(experience.get("duration", ""), 50),
                "description": truncate_text(experience.get("description", ""), MAX_DESCRIPTION_LENGTH)
            }
            parsed["experiences"].append(exp_data)
            parsed["current_title"] = exp_data["title"]
            parsed["current_company"] = exp_data["company"]
        else:
            log_to_file(f"DEBUG: No valid experience data found")
        
        log_to_file(f"DEBUG: Final parsed experiences: {parsed['experiences']}")
        
        # Parse education - BrightData structure is different
        education = profile_data.get("education", [])
        if isinstance(education, list):
            # Limit the number of education entries processed
            limited_education = education[:MAX_EDUCATION]
            for edu in limited_education:
                if isinstance(edu, dict):
                    parsed["education"].append({
                        "school": truncate_text(edu.get("title", ""), 150),
                        "degree": "",  # Not provided in BrightData response
                        "field": "",   # Not provided in BrightData response
                        "years": f"{edu.get('start_year', '')}-{edu.get('end_year', '')}" if edu.get('start_year') or edu.get('end_year') else ""
                    })
        
        # Parse projects
        projects = profile_data.get("projects")
        if projects and isinstance(projects, list):
            # Limit the number of projects processed
            limited_projects = projects[:MAX_PROJECTS]
            for project in limited_projects:
                if isinstance(project, dict):
                    parsed["projects"].append({
                        "title": truncate_text(project.get("title", ""), 100),
                        "description": truncate_text(project.get("description", ""), MAX_DESCRIPTION_LENGTH),
                        "url": truncate_text(project.get("url", ""), 200)
                    })
        elif projects and isinstance(projects, dict):
            # Single project object
            parsed["projects"].append({
                "title": truncate_text(projects.get("title", ""), 100),
                "description": truncate_text(projects.get("description", ""), MAX_DESCRIPTION_LENGTH),
                "url": truncate_text(projects.get("url", ""), 200)
            })
        
        # Parse publications
        publications = profile_data.get("publications")
        if publications and isinstance(publications, list):
            # Limit the number of publications processed
            limited_publications = publications[:MAX_PUBLICATIONS]
            for pub in limited_publications:
                if isinstance(pub, dict):
                    parsed["publications"].append({
                        "title": truncate_text(pub.get("title", ""), 150),
                        "description": truncate_text(pub.get("description", ""), MAX_DESCRIPTION_LENGTH),
                        "url": truncate_text(pub.get("url", ""), 200),
                        "date": truncate_text(pub.get("date", ""), 50)
                    })
        elif publications and isinstance(publications, dict):
            # Single publication object
            parsed["publications"].append({
                "title": truncate_text(publications.get("title", ""), 150),
                "description": truncate_text(publications.get("description", ""), MAX_DESCRIPTION_LENGTH),
                "url": truncate_text(publications.get("url", ""), 200),
                "date": truncate_text(publications.get("date", ""), 50)
            })
        
        # Log final profile size for monitoring
        total_chars = len(str(parsed))
        log_to_file(f"📊 Parsed profile total size: {total_chars} characters")
        if total_chars > 10000:  # Warning threshold
            log_to_file(f"⚠️ Large profile detected: {total_chars} chars for {parsed.get('name', 'Unknown')}")
        
        return parsed
        
    except Exception as e:
        log_to_file(f"Error parsing LinkedIn data: {str(e)}")
        return {
            "name": "",
            "headline": "",
            "about": "",
            "experiences": [],
            "education": [],
            "location": "",
            "current_company": "",
            "current_title": ""
        }

def validate_profile_size(profile_data):
    """Validate and potentially reject profiles that are too large to process efficiently"""
    try:
        # Convert to string to measure size
        profile_str = str(profile_data)
        profile_size = len(profile_str)
        
        # Define size thresholds
        MAX_RAW_PROFILE_SIZE = 50000  # 50KB raw profile data limit
        WARNING_PROFILE_SIZE = 25000  # 25KB warning threshold
        
        log_to_file(f"📏 Profile validation - Raw size: {profile_size} characters")
        
        if profile_size > MAX_RAW_PROFILE_SIZE:
            log_to_file(f"❌ Profile rejected - too large: {profile_size} chars (max: {MAX_RAW_PROFILE_SIZE})")
            return False, f"Profile too large ({profile_size} chars) - may cause performance issues"
        
        if profile_size > WARNING_PROFILE_SIZE:
            log_to_file(f"⚠️ Large profile detected: {profile_size} chars - will be heavily truncated")
        
        # Check for specific problematic fields
        about_text = profile_data.get("about", "")
        if about_text and len(about_text) > 10000:
            log_to_file(f"⚠️ Very long 'about' section: {len(about_text)} chars - will be truncated")
        
        experience = profile_data.get("experience", [])
        if isinstance(experience, list) and len(experience) > 20:
            log_to_file(f"⚠️ Many experiences: {len(experience)} entries - will be limited to top 5")
        
        return True, "Profile size acceptable"
        
    except Exception as e:
        log_to_file(f"Error validating profile size: {str(e)}")
        # If we can't validate, allow processing but log the issue
        return True, "Size validation failed but allowing processing"

def format_profile_for_email(parsed_profile):
    """Format parsed LinkedIn profile data for email generation with size limits"""
    try:
        # Define formatting limits to prevent extremely long emails
        MAX_ABOUT_LENGTH = 800      # Maximum length for about section
        MAX_DESCRIPTION_LENGTH = 150 # Maximum length for experience descriptions
        MAX_TOTAL_EMAIL_LENGTH = 3000 # Maximum total formatted text length
        
        formatted = f"Name: {parsed_profile['name']}\n"
        formatted += f"Position: {parsed_profile['headline']}\n"
        
        # About section with length limit
        if parsed_profile['about']:
            about_text = parsed_profile['about']
            if len(about_text) > MAX_ABOUT_LENGTH:
                # Find a good breaking point near the limit
                about_text = about_text[:MAX_ABOUT_LENGTH].rsplit('.', 1)[0] + "..."
            formatted += f"\nAbout:\n{about_text}\n"
        
        # Experience section - limit both number and description length
        if parsed_profile['experiences']:
            formatted += "\nExperience:\n"
            for i, exp in enumerate(parsed_profile['experiences'][:3]):  # Top 3 experiences
                formatted += f"• {exp['title']} at {exp['company']}"
                if exp['duration']:
                    formatted += f" ({exp['duration']})"
                formatted += "\n"
                if exp['description']:
                    desc = exp['description']
                    if len(desc) > MAX_DESCRIPTION_LENGTH:
                        desc = desc[:MAX_DESCRIPTION_LENGTH].rsplit(' ', 1)[0] + "..."
                    formatted += f"  {desc}\n"
        
        # Education section
        if parsed_profile['education']:
            formatted += "\nEducation:\n"
            for edu in parsed_profile['education'][:2]:  # Top 2 education entries
                school_info = edu['school']
                if edu['years']:
                    school_info += f" ({edu['years']})"
                formatted += f"• {school_info}\n"
        
        # Projects section - limit both number and description length
        if parsed_profile.get('projects'):
            formatted += "\nProjects:\n"
            for project in parsed_profile['projects'][:2]:  # Top 2 projects
                formatted += f"• {project['title']}"
                if project['description']:
                    desc = project['description']
                    if len(desc) > 100:  # Shorter limit for projects
                        desc = desc[:100].rsplit(' ', 1)[0] + "..."
                    formatted += f": {desc}"
                formatted += "\n"
        
        # Publications section - limit both number and description length
        if parsed_profile.get('publications'):
            formatted += "\nPublications:\n"
            for pub in parsed_profile['publications'][:2]:  # Top 2 publications
                formatted += f"• {pub['title']}"
                if pub['date']:
                    formatted += f" ({pub['date']})"
                if pub['description']:
                    desc = pub['description']
                    if len(desc) > 80:  # Shorter limit for publications
                        desc = desc[:80].rsplit(' ', 1)[0] + "..."
                    formatted += f": {desc}"
                formatted += "\n"
        
        # Final size check - truncate if still too long
        if len(formatted) > MAX_TOTAL_EMAIL_LENGTH:
            log_to_file(f"⚠️ Formatted profile too long ({len(formatted)} chars), truncating to {MAX_TOTAL_EMAIL_LENGTH}")
            formatted = formatted[:MAX_TOTAL_EMAIL_LENGTH].rsplit('\n', 1)[0] + "\n...[Profile truncated for email generation]"
        
        # Log final formatted size
        log_to_file(f"📊 Formatted profile size: {len(formatted)} characters for {parsed_profile.get('name', 'Unknown')}")
        
        return formatted
        
    except Exception as e:
        log_to_file(f"Error formatting profile: {str(e)}")
        return f"Name: {parsed_profile.get('name', '')}\nPosition: {parsed_profile.get('headline', '')}"

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    app.run(debug=debug_mode, host="0.0.0.0", port=port)
