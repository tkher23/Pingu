#!/bin/bash
# Test script for Agentic Mode API endpoints

echo "🧪 Testing Pingu Agentic Mode API Endpoints"
echo "============================================="

# Set your local server URL
BASE_URL="http://localhost:5000"

# You'll need a real auth token for testing
# Get this from your Chrome extension's localStorage
AUTH_TOKEN="your_auth_token_here"

echo ""
echo "1️⃣ Testing /api/scrape-linkedin endpoint..."
echo "-------------------------------------------"

curl -X POST "$BASE_URL/api/scrape-linkedin" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "url": "https://www.linkedin.com/in/sample-profile/"
  }' \
  -v

echo ""
echo ""
echo "2️⃣ Testing /api/scrape-result endpoint..."
echo "----------------------------------------"
echo "Note: You'll need a real job_id from step 1"

# Replace 'sample_job_id' with actual job ID from step 1
curl -X GET "$BASE_URL/api/scrape-result/sample_job_id" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -v

echo ""
echo "✅ API endpoint tests completed!"
echo ""
echo "💡 Tips:"
echo "- Replace AUTH_TOKEN with a real token from your extension"
echo "- Replace sample_job_id with actual job ID from scrape-linkedin response"
echo "- Make sure your .env file has BRIGHT_DATA_TOKEN and BRIGHT_DATA_DATASET_ID"
