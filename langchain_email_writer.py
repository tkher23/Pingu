
import os
from dotenv import load_dotenv
from langchain_community.chat_models import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain.prompts import PromptTemplate

load_dotenv()

llm = ChatOpenAI(
    model_name="gpt-3.5-turbo",
    temperature=0.7,
    openai_api_key=os.getenv("OPENAI_API_KEY")
)

email_prompt_template = PromptTemplate(
    input_variables=["user_name", "user_intro", "persona_context", "internship_interest", "recipient_name", "headline", "bio", "experiences", "education", "projects", "publications", "bio_page", "company_values", "role_type", "company_of_interest"],
    template="""  
You are {user_name}, {user_intro}, and you're currently looking for a {role_type} opportunity in {internship_interest} at {company_of_interest}.

You want to send a short, friendly cold email to {recipient_name}, who has the following background:

- Headline: {headline}
- Bio: {bio}
- Experience: {experiences}
- Education: {education}
- Projects: {projects}
- Publications: {publications}

Their company values include:
{company_values}

You've also read their bio page:
{bio_page}

Here is some personal context about you: "{persona_context}".

=== IMPORTANT INSTRUCTIONS ===
The recipient's profile information may be incomplete or missing. Handle this gracefully:

1. **If there's rich information** (projects, publications, detailed experience): Reference 1-2 specific, impressive details that genuinely connect to your interests
2. **If information is limited** (just name/title): Focus on the company, role, or industry instead
3. **If bio/about is cut off or incomplete**: Don't reference it specifically, focus on their role or company
4. **If no projects/publications**: Reference their experience, education, or company achievements instead
5. **Always be genuine**: Only mention what actually exists and seems meaningful

=== TASK ===
Write a short cold email (max 125 words) from the perspective of {user_name}. The email should:

- Start with "Dear [First Name Only]" (extract just the first name from {recipient_name})
- Briefly introduce who you are
- Find the BEST available connection point from their profile (experience, projects, publications, education, or company)
- If profile is sparse, focus on the company/industry instead of personal details
- Clearly ask about a potential {role_type} opportunity
- End by asking for a short (15-minute) chat or career advice
- Be informal, warm, and human — but concise
- Do **not** mention where you found their profile or say "I came across you through..."
- **Adapt your approach** based on available information quality
- **IMPORTANT**: Write ONLY the email body. Do NOT include a subject line, "Subject:" field, or any email headers. Start directly with "Dear [First Name]" where you extract the first name from "{recipient_name}".

Write the email body below:
"""
)

def generate_email(profile):
    linkedin = profile["linkedin"]
    user_info = profile.get("user_info", {})
    context = user_info.get("persona_context", "").strip()

    # Extract and format profile data with fallbacks
    def safe_join(items, fallback="Not specified"):
        if not items or items == []:
            return fallback
        # Filter out empty strings and join
        filtered = [str(item).strip() for item in items if str(item).strip()]
        return ", ".join(filtered) if filtered else fallback
    
    # Get basic info with fallbacks
    headline = linkedin.get("headline", "") or "Professional"
    bio = linkedin.get("details", {}).get("bio", "") or "Bio not available"
    
    # Truncate bio if it seems cut off or too long
    if bio and len(bio) > 300:
        bio = bio[:300] + "... [profile continues]"
    
    experiences = safe_join(linkedin.get("details", {}).get("experiences", []), "Experience details not available")
    education = safe_join(linkedin.get("details", {}).get("education", []), "Education details not available")
    
    # Extract projects and publications from the raw_text if available
    # The formatted text from format_profile_for_email includes these sections
    raw_text = linkedin.get("raw_text", "")
    projects_section = ""
    publications_section = ""
    
    if raw_text:
        # Extract projects section
        if "Projects:" in raw_text:
            projects_start = raw_text.find("Projects:")
            publications_start = raw_text.find("Publications:", projects_start)
            if publications_start == -1:
                projects_section = raw_text[projects_start:].strip()
            else:
                projects_section = raw_text[projects_start:publications_start].strip()
        
        # Extract publications section  
        if "Publications:" in raw_text:
            publications_start = raw_text.find("Publications:")
            publications_section = raw_text[publications_start:].strip()
    
    # Format extracted sections or use fallbacks
    projects = projects_section if projects_section else "No projects listed"
    publications = publications_section if publications_section else "No publications listed"

    messages = []

    # Enhanced system message based on data availability
    if context:
        messages.append(SystemMessage(content=f"Write as someone who values: {context}. Adapt your approach based on the completeness of the recipient's profile information."))
    else:
        messages.append(SystemMessage(content="Write a professional but warm email. Adapt your approach based on the completeness of the recipient's profile information."))

    messages.append(HumanMessage(
        content=email_prompt_template.format(
            user_name=user_info.get("name", "Your Name"),
            user_intro=user_info.get("intro", "a student"),
            persona_context=context or "someone passionate about learning and growth",
            internship_interest=profile.get("internship_interest", "your field"),
            recipient_name=profile.get("recipient_name", "there"),
            headline=headline,
            bio=bio,
            experiences=experiences,
            education=education,
            projects=projects,
            publications=publications,
            bio_page=profile.get("bio_page", "") or "Company bio not available",
            company_values=profile.get("values_page", "") or "Company values not specified",
            company_of_interest=profile.get("company_of_interest", "the company"),
            role_type=profile.get("role_type", "internship")
        )
    ))

    return llm(messages).content
