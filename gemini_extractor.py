import os
import google.generativeai as genai

# Configure Gemini API key from environment variable
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("models/gemini-1.5-flash")

def extract_profile_info(text, url=None, title=None, extraction_type="personal"):
    """
    Extracts structured info from web page text using Gemini Flash 2.5.
    extraction_type: 'personal' or 'institution'
    Returns a dict with relevant keys for each type.
    """
    if extraction_type == "personal":
        prompt = f"""
Extract the following information from a personal or professional profile webpage. Return as JSON with keys: name, title, company, email, mission, about, linkedin, github, twitter, location.
If a field is not found, return an empty string for that field.

For the 'about' field, extract the full text of any 'about', 'bio', 'summary', or similar section that describes the person in their own words. Prioritize these sections if present.

Website: {url or ''}
Title: {title or ''}
Text:
{text}
"""
    elif extraction_type == "institution":
        prompt = f"""
Extract the following information from an institution, company, or organization webpage. Return as JSON with keys: organization_name, mission, about, contact_email, website, address, key_people, phone, founded_year, industry.
If a field is not found, return an empty string for that field.

For the 'about' and 'mission' fields, extract the full text of any 'about us', 'mission', 'who we are', or similar section that describes the organization. Prioritize these sections if present.

Website: {url or ''}
Title: {title or ''}
Text:
{text}
"""
    else:
        prompt = f"""
Extract the following information from a webpage. Return as JSON with keys: name, title, company, email, mission.
If a field is not found, return an empty string for that field.

Website: {url or ''}
Title: {title or ''}
Text:
{text}
"""
    response = model.generate_content(prompt)
    # Try to parse the response as JSON
    import json
    try:
        result = json.loads(response.text)
    except Exception:
        # Fallback: return raw text in a single field
        result = {"raw": response.text}
    return result

if __name__ == "__main__":
    # Test with Blackstone profile page visible text
    # 1. Go to https://www.blackstone.com/the-firm/our-people/#bio-stephen-a-schwarzman
    # 2. Open DevTools Console and run: copy(document.body.innerText)
    # 3. Paste the copied text below:
    sample_text = """
PASTE COPIED VISIBLE TEXT FROM THE PAGE HERE
"""
    result = extract_profile_info(
        sample_text,
        url="https://www.blackstone.com/the-firm/our-people/#bio-stephen-a-schwarzman",
        title="Stephen A. Schwarzman - Blackstone",
        extraction_type="personal"
    )
    print("\nBlackstone profile extraction result:")
    print(result)

    # Simple test for institution extraction
    sample_text_institution = """
    Acme University is a leading institution founded in 1901. 
    Mission: To empower students to change the world. 
    About Us: Acme University offers a wide range of programs and is located in Springfield. 
    Contact: info@acmeuniversity.edu
    """
    result2 = extract_profile_info(sample_text_institution, url="https://acmeuniversity.edu", title="Acme University", extraction_type="institution")
    print("\nInstitution extraction result:")
    print(result2)
