
import os
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import json
from langchain_email_writer import generate_email

# Load environment variables
load_dotenv()

# === Parsing Functions ===

def parse_linkedin(raw_text, person_name=None):
    profile_data = {
        "source": "LinkedIn",
        "person_name": person_name,
        "headline": None,
        "details": {
            "bio": None,
            "experiences": [],
            "education": [],
            "achievements": [],
            "interests": []
        }
    }
    try:
        raw_text = " ".join(raw_text.split())
        headline_end = raw_text.find("About")
        if headline_end != -1:
            profile_data["headline"] = raw_text[:headline_end].strip()
        about_start = raw_text.find("About")
        experience_start = raw_text.find("Experience")
        if about_start != -1 and experience_start != -1:
            profile_data["details"]["bio"] = raw_text[about_start + len("About"): experience_start].strip()
        education_start = raw_text.find("Education")
        if experience_start != -1 and education_start != -1:
            experiences = raw_text[experience_start + len("Experience"): education_start].strip()
            profile_data["details"]["experiences"] = experiences.split("•")
        skills_start = raw_text.find("Skills")
        if education_start != -1:
            education = raw_text[education_start + len("Education"): (skills_start if skills_start != -1 else len(raw_text))].strip()
            profile_data["details"]["education"] = education.split("•")
    except Exception as e:
        print(f"Error parsing LinkedIn data: {e}")
    return profile_data

def parse_bio_page_new(raw_text):
    if not isinstance(raw_text, str):
        return ""
    return raw_text[:1500]

def extract_all_text(raw_text, max_tokens=300):
    try:
        return raw_text[:2000]
    except Exception as e:
        print(f"Error extracting company values: {e}")
        return ""

# === Full Workflow ===

def process_profiles_batch(profiles):
    for profile in profiles:
        linkedin_raw_text = profile.get("linkedin", {}).get("raw_text", "")
        bio_raw_text = profile.get("bio_page", {}).get("raw_text", "")
        values_raw_text = profile.get("values_page", {}).get("raw_text", "")

        profile["linkedin"] = parse_linkedin(linkedin_raw_text)
        profile["bio_page"] = parse_bio_page_new(bio_raw_text)
        profile["values_page"] = extract_all_text(values_raw_text)

    for profile in profiles:
        profile["generated_email"] = generate_email(profile)

    return profiles

if __name__ == "__main__":
    import sys
    try:
        input_data = json.loads(sys.argv[1])
        if "profiles" not in input_data:
            raise ValueError("Missing 'profiles' key in the input data.")
        processed_profiles = process_profiles_batch(input_data["profiles"])
        sys.stdout.write(json.dumps(processed_profiles))
        sys.stdout.flush()
    except json.JSONDecodeError as jde:
        sys.stderr.write(f"JSON decode error: {str(jde)}\n")
        sys.stderr.flush()
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"Error processing file: {str(e)}\n")
        sys.stderr.flush()
        sys.exit(1)
