from flask import Flask, request, jsonify
import os
import pandas as pd
from backend import process_profiles_batch  # Import your processing logic
from flask_cors import CORS
import json


# Load environment variables
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app)

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
        return jsonify(processed[0]), 200

    except Exception as e:
        print("❌ ERROR:", e)
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
