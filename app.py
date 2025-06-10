from flask import Flask, request, jsonify
import os
import pandas as pd
from backend import process_profiles_batch  # Import your processing logic
from flask_cors import CORS
import json
import requests


# Load environment variables
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

app = Flask(__name__)
CORS(app)

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
        # 🚫 Check if user has credits remaining
        user_credits = get_user_credits(user_id)
        if user_credits <= 0:
            return jsonify({"error": "You’ve used all your credits. Please contact support to request more."}), 403
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

        processed = process_profiles_batch([profile])

        # ✅ Subtract credit after successful processing
        decrement_user_credits(user_id)

        return jsonify(processed[0]), 200

    except Exception as e:
        print("❌ ERROR:", e)
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route('/api/get-credits', methods=['GET'])
def get_credits():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_id_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    credits = get_user_credits(user_id)
    return jsonify({"credits": credits}), 200

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

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)