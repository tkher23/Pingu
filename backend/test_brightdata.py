#!/usr/bin/env python3
"""
Test script for BrightData LinkedIn scraping integration
Tests both parsing logic AND actual API calls
"""

import json
import os
import requests
import time
from dotenv import load_dotenv
from backend import parse_brightdata_linkedin_for_backend
from app import parse_brightdata_linkedin, format_profile_for_email

# Load environment variables
load_dotenv()

# Configuration
API_BASE_URL = "http://localhost:5000"  # Local Flask server
BRIGHT_DATA_TOKEN = os.getenv("BRIGHT_DATA_TOKEN")
BRIGHT_DATA_DATASET_ID = os.getenv("BRIGHT_DATA_DATASET_ID")

# Sample BrightData response (for parsing tests)
sample_brightdata_response = [
    {
        "timestamp": "2025-08-02",
        "linkedin_num_id": "680087186",
        "url": "https://www.linkedin.com/in/sample-profile",
        "name": "Ana Torres",
        "country_code": "BR",
        "city": "Novo Mundo, Mato Grosso, Brazil",
        "about": "Passionate about technology and innovation. Currently studying at UFMT.",
        "followers": 8,
        "connections": 8,
        "position": "Aluno na UFMT - Universidade Federal de Mato Grosso",
        "experience": [
            {
                "title": "Software Engineering Intern",
                "company": "Tech Corp",
                "duration": "2023-2024",
                "description": "Worked on web development projects using React and Python."
            }
        ],
        "projects": [
            {
                "title": "AI-Powered Email Generator",
                "description": "Built a machine learning system that generates personalized emails using natural language processing.",
                "url": "https://github.com/ana/email-generator"
            },
            {
                "title": "Smart Campus App",
                "description": "Developed a mobile application for university students to manage their schedules and connect with peers.",
                "url": "https://github.com/ana/campus-app"
            }
        ],
        "publications": [
            {
                "title": "Machine Learning Applications in Customer Communication",
                "description": "Research paper on using AI to improve customer engagement through personalized messaging.",
                "date": "2024",
                "url": "https://arxiv.org/paper123"
            }
        ],
        "current_company": {
            "location": None
        },
        "current_company_name": None,
        "current_company_company_id": None,
        "posts": None,
        "activity": None,
        "education": [
            {
                "description": None,
                "description_html": None,
                "end_year": "2022",
                "institute_logo_url": "https://media.licdn.com/example.jpg",
                "start_year": "2018",
                "title": "UFMT - Universidade Federal de Mato Grosso",
                "url": "https://br.linkedin.com/school/ufmt/"
            }
        ],
        "educations_details": "UFMT - Universidade Federal de Mato Grosso",
        "courses": None,
        "certifications": None,
        "honors_and_awards": None,
        "volunteer_experience": None,
        "organizations": None,
        "recommendations_count": None,
        "recommendations": None,
        "languages": None,
        "projects": None,
        "patents": None,
        "publications": None,
        "avatar": "https://static.licdn.com/aero-v1/sc/h/9c8pery4andzj6ohjkjp54ma2",
        "default_avatar": True,
        "banner_image": "https://static.licdn.com/aero-v1/sc/h/5q92mjc5c51bjwaj3rs9aa82",
        "similar_profiles": [],
        "people_also_viewed": None,
        "memorialized_account": False,
        "input_url": "https://www.linkedin.com/in/sample-profile",
        "linkedin_id": "ana-torres-829",
        "bio_links": [],
        "first_name": "Ana",
        "last_name": "Torres"
    }
]

def test_brightdata_api_direct():
    """Test direct BrightData API calls"""
    print("🌐 Testing Direct BrightData API Calls...")
    print("=" * 60)
    
    if not BRIGHT_DATA_TOKEN or not BRIGHT_DATA_DATASET_ID:
        print("❌ Missing BRIGHT_DATA_TOKEN or BRIGHT_DATA_DATASET_ID in .env file")
        print("   Please add these to your .env file to test API calls")
        return None, None
    
    # Test LinkedIn URL
    test_url = "https://www.linkedin.com/in/elad-moshe-05a90413/"
    
    print(f"📤 Triggering scrape for: {test_url}")
    
    # 1. Trigger scraping job
    trigger_url = "https://api.brightdata.com/datasets/v3/trigger"
    headers = {
        "Authorization": f"Bearer {BRIGHT_DATA_TOKEN}",
        "Content-Type": "application/json"
    }
    params = {
        "dataset_id": BRIGHT_DATA_DATASET_ID,
        "include_errors": "true"
    }
    data = [{"url": test_url}]
    
    try:
        print("🚀 Making BrightData trigger request...")
        response = requests.post(trigger_url, headers=headers, params=params, json=data)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.ok:
            result = response.json()
            job_id = result.get("snapshot_id")
            print(f"✅ Job triggered successfully! Job ID: {job_id}")
            return job_id, headers
        else:
            print(f"❌ Failed to trigger job: {response.status_code} - {response.text}")
            return None, None
            
    except Exception as e:
        print(f"❌ Error triggering BrightData job: {e}")
        return None, None

def test_brightdata_result_polling(job_id, headers):
    """Test polling for BrightData results"""
    if not job_id:
        print("❌ No job ID to poll")
        return None
        
    print(f"\n⏳ Polling for results (Job ID: {job_id})...")
    print("=" * 60)
    
    result_url = f"https://api.brightdata.com/datasets/v3/snapshot/{job_id}"
    params = {"format": "json"}
    
    max_attempts = 10
    for attempt in range(max_attempts):
        try:
            print(f"🔍 Attempt {attempt + 1}/{max_attempts}")
            response = requests.get(result_url, headers=headers, params=params)
            print(f"Status: {response.status_code}")
            
            if response.ok:
                result = response.json()
                
                # Check if result is a list (completed data) or dict (status info)
                if isinstance(result, list):
                    print("✅ Job completed! Got data directly as list")
                    if result:
                        print(f"📊 Found {len(result)} profiles")
                        print("📋 Sample data preview:")
                        print(json.dumps(result[0], indent=2)[:300] + "...")
                        return result[0]  # Return first profile
                    else:
                        print("❌ Empty results list")
                        return None
                        
                elif isinstance(result, dict):
                    # Handle dict response with status
                    status = result.get("status")
                    print(f"Job Status: {status}")
                    
                    if status == "completed":
                        print("✅ Job completed! Getting results...")
                        data = result.get("data", [])
                        if data:
                            print(f"📊 Found {len(data)} profiles")
                            return data[0]  # Return first profile
                        else:
                            print("❌ No data in completed job")
                            return None
                    elif status == "failed":
                        print("❌ Job failed")
                        print(f"Error: {result}")
                        return None
                    else:
                        print(f"⏱️  Job still {status}, waiting 10 seconds...")
                        time.sleep(10)
                else:
                    print(f"❌ Unexpected response type: {type(result)}")
                    print(f"Response: {result}")
                    return None
            else:
                print(f"❌ Error checking status: {response.status_code} - {response.text}")
                
        except Exception as e:
            print(f"❌ Error polling results: {e}")
            print(f"Response type: {type(response.json()) if response.ok else 'N/A'}")
            
    print("⏰ Timeout waiting for job completion")
    return None

def test_flask_api_endpoints(auth_token="test_token"):
    """Test our Flask API endpoints"""
    print(f"\n🚀 Testing Flask API Endpoints ({API_BASE_URL})...")
    print("=" * 60)
    
    # Test 1: Trigger scraping endpoint
    print("1️⃣ Testing /api/scrape-linkedin...")
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/scrape-linkedin",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {auth_token}"
            },
            json={"url": "https://www.linkedin.com/in/elad-moshe-05a90413/"}
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.ok:
            result = response.json()
            job_id = result.get("job_id")
            print(f"✅ Scrape triggered! Job ID: {job_id}")
            
            # Test 2: Poll for results
            if job_id:
                print(f"\n2️⃣ Testing /api/scrape-result/{job_id}...")
                
                # Poll a few times
                for i in range(3):
                    print(f"🔍 Poll attempt {i + 1}/3")
                    result_response = requests.get(
                        f"{API_BASE_URL}/api/scrape-result/{job_id}",
                        headers={"Authorization": f"Bearer {auth_token}"}
                    )
                    print(f"Status: {result_response.status_code}")
                    print(f"Response: {result_response.text}")
                    
                    if result_response.ok:
                        result_data = result_response.json()
                        if result_data.get("status") == "done":
                            print("✅ Email generation completed!")
                            print(f"Subject: {result_data.get('generated_subject', 'N/A')}")
                            print(f"Email length: {len(result_data.get('generated_email', ''))}")
                            break
                        else:
                            print(f"⏱️  Status: {result_data.get('status', 'unknown')}")
                            time.sleep(5)
                    else:
                        print(f"❌ Error: {result_response.status_code}")
                        break
        else:
            print(f"❌ Failed to trigger scrape: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed! Is the Flask server running on localhost:5000?")
        print("   Run: python app.py")
    except Exception as e:
        print(f"❌ Error testing Flask API: {e}")

def test_brightdata_parsing():
    """Test the BrightData parsing functions"""
    print("\n🧪 Testing BrightData LinkedIn Parsing Logic...")
    print("=" * 60)
    
    # Get the first profile from sample data
    profile_data = sample_brightdata_response[0]
    
    print("📥 Input BrightData Response:")
    print(json.dumps(profile_data, indent=2)[:500] + "...")
    print("\n" + "=" * 60)
    
    # Test app.py parsing
    print("🔧 Testing app.py parsing...")
    parsed_profile = parse_brightdata_linkedin(profile_data)
    print("📤 Parsed Profile (app.py):")
    print(json.dumps(parsed_profile, indent=2))
    print("\n" + "=" * 60)
    
    # Test formatting for email
    print("📧 Testing email formatting...")
    formatted_email_data = format_profile_for_email(parsed_profile)
    print("📤 Formatted for Email:")
    print(formatted_email_data)
    print("\n" + "=" * 60)
    
    # Test backend.py parsing
    print("🔧 Testing backend.py parsing...")
    backend_result = parse_brightdata_linkedin_for_backend(profile_data)
    print("📤 Backend Processing Result:")
    print(json.dumps(backend_result, indent=2))
    print("\n" + "=" * 60)
    
    print("✅ Parsing tests completed!")

def test_full_email_generation():
    """Test the complete email generation pipeline with projects and publications"""
    print("\n🧪 Testing Full Email Generation Pipeline...")
    print("=" * 60)
    
    # Use our sample data with projects and publications
    profile_data = sample_brightdata_response[0]
    
    # Parse the LinkedIn data
    parsed_profile = parse_brightdata_linkedin(profile_data)
    
    # Create a complete profile for email generation (matching app.py structure)
    email_profile = {
        "linkedin": {"raw_text": format_profile_for_email(parsed_profile)},
        "bio_page": {"raw_text": ""},
        "values_page": {"raw_text": "Innovation, collaboration, and continuous learning"},
        "user_info": {
            "name": "Alex Johnson",
            "intro": "a computer science student",
            "persona_context": "passionate about AI and machine learning",
            "company_interest": "UFMT"
        },
        "recipient_name": "Ana Torres",
        "internship_interest": "software engineering",
        "company_of_interest": "UFMT",
        "role_type": "internship"
    }
    
    print("📧 Testing email generation with rich profile data...")
    try:
        from backend import process_profiles_batch
        
        # Debug: Show the formatted text that will be parsed
        print("🔍 Debug - Formatted LinkedIn text:")
        print(email_profile['linkedin']['raw_text'])
        print("\n" + "=" * 40)
        
        # Generate email using the full pipeline
        processed = process_profiles_batch([email_profile], generate_email_flag=True, generate_subject_flag=True)
        
        generated_email = processed[0].get("generated_email", "")
        generated_subject = processed[0].get("generated_subject", "")
        
        print("✅ Email Generation Results:")
        print(f"📧 Subject: {generated_subject}")
        print(f"📝 Email:\n{generated_email}")
        print("\n" + "=" * 60)
        
        # Test with sparse profile (minimal data)
        print("📧 Testing email generation with sparse profile data...")
        
        sparse_profile = {
            "linkedin": {"raw_text": "Name: John Doe\nPosition: Software Engineer"},
            "bio_page": {"raw_text": ""},
            "values_page": {"raw_text": ""},
            "user_info": {
                "name": "Alex Johnson",
                "intro": "a computer science student",
                "persona_context": "passionate about technology"
            },
            "recipient_name": "John Doe",
            "internship_interest": "software development",
            "company_of_interest": "Tech Company",
            "role_type": "internship"
        }
        
        processed_sparse = process_profiles_batch([sparse_profile], generate_email_flag=True, generate_subject_flag=False)
        sparse_email = processed_sparse[0].get("generated_email", "")
        
        print("✅ Sparse Profile Email Results:")
        print(f"📝 Email:\n{sparse_email}")
        print("\n✅ Full email generation tests completed!")
        
        return True
        
    except Exception as e:
        print(f"❌ Error in email generation: {e}")
        print("💡 Make sure you have OPENAI_API_KEY set in your .env file")
        return False

def test_null_handling():
    """Test handling of null values"""
    print("\n🧪 Testing NULL Value Handling...")
    print("=" * 60)
    
    # Sample with null values (like your original example)
    null_profile = {
        "name": "Test User",
        "position": "Student",
        "city": "Test City",
        "about": None,  # null value
        "experience": None,  # null value
        "education": [
            {
                "title": "Test University",
                "start_year": "2020",
                "end_year": "2024"
            }
        ]
    }
    
    print("📥 Input with NULL values:")
    print(json.dumps(null_profile, indent=2))
    
    # Test parsing
    parsed = parse_brightdata_linkedin(null_profile)
    print("\n📤 Parsed Result:")
    print(json.dumps(parsed, indent=2))
    
    # Test formatting
    formatted = format_profile_for_email(parsed)
    print("\n📤 Formatted Result:")
    print(formatted)
    
    print("\n✅ NULL handling test completed!")

def run_all_tests():
    """Run all tests in sequence"""
    print("🧪 PINGU AGENTIC MODE - COMPREHENSIVE TEST SUITE")
    print("=" * 70)
    print("This will test:")
    print("  1. Local parsing logic")
    print("  2. Direct BrightData API calls")
    print("  3. Flask API endpoints")
    print("  4. NULL value handling")
    print("=" * 70)
    
    # Test 1: Local parsing
    test_brightdata_parsing()
    test_null_handling()
    
    # Test 1.5: Full email generation
    print(f"\n{'='*70}")
    user_input_email = input("🤔 Test full email generation (requires OpenAI API)? (y/N): ")
    if user_input_email.lower() == 'y':
        test_full_email_generation()
    
    # Test 2: Direct BrightData API (optional - requires real API)
    print(f"\n{'='*70}")
    user_input = input("🤔 Test direct BrightData API? This uses real API calls. (y/N): ")
    if user_input.lower() == 'y':
        job_id, headers = test_brightdata_api_direct()
        if job_id and headers:
            user_input2 = input("🤔 Wait for BrightData results? This may take 1-2 minutes. (y/N): ")
            if user_input2.lower() == 'y':
                real_data = test_brightdata_result_polling(job_id, headers)
                if real_data:
                    print("\n📊 Testing parsing with REAL BrightData response:")
                    parsed_real = parse_brightdata_linkedin(real_data)
                    formatted_real = format_profile_for_email(parsed_real)
                    print("📤 Real Data Formatted for Email:")
                    print(formatted_real)
    
    # Test 3: Flask API endpoints
    print(f"\n{'='*70}")
    user_input3 = input("🤔 Test Flask API endpoints? Flask server must be running. (y/N): ")
    if user_input3.lower() == 'y':
        auth_token = input("🔑 Enter auth token (or press Enter for 'test_token'): ").strip()
        if not auth_token:
            auth_token = "test_token"
        test_flask_api_endpoints(auth_token)
    
    print(f"\n{'='*70}")
    print("🎉 All tests completed!")
    print("\n💡 Next steps:")
    print("  1. If parsing tests passed ✅ - Your logic is working!")
    print("  2. If BrightData API tests passed ✅ - Your API integration works!")
    print("  3. If Flask tests passed ✅ - Your backend is ready!")
    print("  4. Build your Chrome extension and test the full flow!")

if __name__ == "__main__":
    run_all_tests()
