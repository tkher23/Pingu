import os
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import json
from langchain_email_writer import generate_email
from generate_subject import generate_subject
from simple_email import generate_simple_email

# Load environment variables
load_dotenv()

# === Parsing Functions ===

def parse_linkedin(raw_text, person_name=None):
    profile_data = {
        "source": "LinkedIn",
        "person_name": person_name,
        "headline": None,
        "raw_text": raw_text,  # Store the original text for projects/publications extraction
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
        
        # Parse headline (everything before "About")
        headline_end = raw_text.find("About")
        if headline_end != -1:
            profile_data["headline"] = raw_text[:headline_end].strip()
        
        # Parse About section
        about_start = raw_text.find("About")
        experience_start = raw_text.find("Experience")
        if about_start != -1 and experience_start != -1:
            profile_data["details"]["bio"] = raw_text[about_start + len("About"): experience_start].strip()
        
        # Parse Experience section
        education_start = raw_text.find("Education")
        if experience_start != -1 and education_start != -1:
            experiences = raw_text[experience_start + len("Experience"): education_start].strip()
            profile_data["details"]["experiences"] = [exp.strip() for exp in experiences.split("•") if exp.strip()]
        
        # Parse Education section
        projects_start = raw_text.find("Projects:")
        skills_start = raw_text.find("Skills")
        education_end = projects_start if projects_start != -1 else (skills_start if skills_start != -1 else len(raw_text))
        
        if education_start != -1:
            education = raw_text[education_start + len("Education"): education_end].strip()
            profile_data["details"]["education"] = [edu.strip() for edu in education.split("•") if edu.strip()]
        
        # Parse Projects section (NEW)
        if projects_start != -1:
            publications_start = raw_text.find("Publications:", projects_start)
            projects_end = publications_start if publications_start != -1 else len(raw_text)
            projects = raw_text[projects_start + len("Projects:"): projects_end].strip()
            profile_data["details"]["achievements"] = [proj.strip() for proj in projects.split("•") if proj.strip()]
        
        # Parse Publications section (NEW)
        publications_start = raw_text.find("Publications:")
        if publications_start != -1:
            publications = raw_text[publications_start + len("Publications:"):].strip()
            profile_data["details"]["interests"] = [pub.strip() for pub in publications.split("•") if pub.strip()]
            
    except Exception as e:
        print(f"Error parsing LinkedIn data: {e}")
    return profile_data

def parse_brightdata_linkedin_for_backend(profile_data):
    """Parse BrightData LinkedIn response for backend processing"""
    try:
        formatted_text = f"Name: {profile_data.get('name', '')}\n"
        formatted_text += f"Position: {profile_data.get('position', '')}\n"  # BrightData uses 'position' not 'headline'
        
        if profile_data.get('about'):
            formatted_text += f"\nAbout:\n{profile_data.get('about')}\n"
        
        # Handle experience - can be null
        experience = profile_data.get('experience')
        if experience:
            formatted_text += "\nExperience:\n"
            if isinstance(experience, list):
                for exp in experience[:3]:  # Limit to top 3
                    formatted_text += f"• {exp.get('title', '')} at {exp.get('company', '')}"
                    if exp.get('duration'):
                        formatted_text += f" ({exp.get('duration')})"
                    formatted_text += "\n"
                    if exp.get('description'):
                        formatted_text += f"  {exp.get('description', '')[:200]}...\n"
            elif isinstance(experience, dict):
                # Single experience
                formatted_text += f"• {experience.get('title', '')} at {experience.get('company', '')}"
                if experience.get('duration'):
                    formatted_text += f" ({experience.get('duration')})"
                formatted_text += "\n"
        
        # Handle education - different structure in BrightData
        education = profile_data.get('education', [])
        if education and isinstance(education, list):
            formatted_text += "\nEducation:\n"
            for edu in education[:2]:  # Limit to top 2
                school_name = edu.get('title', '')  # BrightData uses 'title' for school name
                years = ""
                if edu.get('start_year') or edu.get('end_year'):
                    years = f" ({edu.get('start_year', '')}-{edu.get('end_year', '')})"
                formatted_text += f"• {school_name}{years}\n"
        
        # Handle projects
        projects = profile_data.get('projects')
        if projects:
            formatted_text += "\nProjects:\n"
            if isinstance(projects, list):
                for project in projects[:2]:  # Limit to top 2
                    formatted_text += f"• {project.get('title', '')}"
                    if project.get('description'):
                        formatted_text += f": {project.get('description', '')[:150]}..."
                    formatted_text += "\n"
            elif isinstance(projects, dict):
                # Single project
                formatted_text += f"• {projects.get('title', '')}"
                if projects.get('description'):
                    formatted_text += f": {projects.get('description', '')[:150]}..."
                formatted_text += "\n"
        
        # Handle publications
        publications = profile_data.get('publications')
        if publications:
            formatted_text += "\nPublications:\n"
            if isinstance(publications, list):
                for pub in publications[:2]:  # Limit to top 2
                    formatted_text += f"• {pub.get('title', '')}"
                    if pub.get('date'):
                        formatted_text += f" ({pub.get('date')})"
                    if pub.get('description'):
                        formatted_text += f": {pub.get('description', '')[:100]}..."
                    formatted_text += "\n"
            elif isinstance(publications, dict):
                # Single publication
                formatted_text += f"• {publications.get('title', '')}"
                if publications.get('date'):
                    formatted_text += f" ({publications.get('date')})"
                if publications.get('description'):
                    formatted_text += f": {publications.get('description', '')[:100]}..."
                formatted_text += "\n"
        
        return {
            "source": "LinkedIn",
            "person_name": profile_data.get('name', ''),
            "headline": profile_data.get('position', ''),  # Map position to headline
            "details": {
                "bio": profile_data.get('about', '') or '',  # Handle null values
                "experiences": [f"{exp.get('title', '')} at {exp.get('company', '')}" for exp in (experience if isinstance(experience, list) else [experience] if experience else [])],
                "education": [edu.get('title', '') for edu in education if isinstance(edu, dict)] if education else [],
                "achievements": [f"{proj.get('title', '')}" for proj in (projects if isinstance(projects, list) else [projects] if projects else [])],  # Map projects to achievements
                "interests": [f"{pub.get('title', '')}" for pub in (publications if isinstance(publications, list) else [publications] if publications else [])]  # Map publications to interests
            }
        }
    except Exception as e:
        print(f"Error parsing BrightData LinkedIn data: {e}")
        return {
            "source": "LinkedIn",
            "person_name": "",
            "headline": "",
            "details": {
                "bio": "",
                "experiences": [],
                "education": [],
                "achievements": [],
                "interests": []
            }
        }

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

def process_profiles_batch(profiles, generate_email_flag=True, generate_subject_flag=True, simple_email=False):
    for profile in profiles:
        linkedin_raw_text = profile.get("linkedin", {}).get("raw_text", "")
        bio_raw_text = profile.get("bio_page", {}).get("raw_text", "")
        values_raw_text = profile.get("values_page", {}).get("raw_text", "")

        profile["linkedin"] = parse_linkedin(linkedin_raw_text)
        profile["bio_page"] = parse_bio_page_new(bio_raw_text)
        profile["values_page"] = extract_all_text(values_raw_text)

    for profile in profiles:
        if generate_email_flag:
            if simple_email:
                profile["generated_email"] = generate_simple_email(profile)
            else:
                profile["generated_email"] = generate_email(profile)
        if generate_subject_flag:
            profile["generated_subject"] = generate_subject(profile)

    return profiles

# === CLI Entry Point (Optional) ===

if __name__ == "__main__":
    import sys
    try:
        input_data = json.loads(sys.argv[1])
        if "profiles" not in input_data:
            raise ValueError("Missing 'profiles' key in the input data.")

        # Allow optional flags in CLI usage
        generate_email_flag = input_data.get("generate_email", True)
        generate_subject_flag = input_data.get("generate_subject", True)

        processed_profiles = process_profiles_batch(
            input_data["profiles"],
            generate_email_flag=generate_email_flag,
            generate_subject_flag=generate_subject_flag
        )

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
