
import os
from dotenv import load_dotenv
from langchain_community.chat_models import ChatOpenAI
from langchain.schema import SystemMessage, HumanMessage
from langchain.prompts import PromptTemplate

load_dotenv()

llm = ChatOpenAI(
    model_name="gpt-3.5-turbo",
    temperature=0.7,
    openai_api_key=os.getenv("OPENAI_API_KEY")
)

email_prompt_template = PromptTemplate(
    input_variables=["user_name", "user_intro", "persona_context", "internship_interest", "recipient_name", "headline", "bio", "experiences", "education", "bio_page", "company_values", "role_type", "company_of_interest"],
    template="""  
You are {user_name}, {user_intro}, and you're currently looking for a {role_type} opportunity in {internship_interest} at {company_of_interest}.

You want to send a short, friendly cold email to {recipient_name}, who has the following background:

- Headline: {headline}
- Bio: {bio}
- Experience: {experiences}
- Education: {education}

Their company values include:
{company_values}

You’ve also read their bio page:
{bio_page}

Here is some personal context about you: "{persona_context}". Use **only one or two** quick, relevant connections to show why you're genuinely interested in both the company and {recipient_name}'s experience.

=== TASK ===
Write a short cold email (max 125 words) from the perspective of {user_name}. The email should:

- Start with "Dear {recipient_name}"
- Briefly introduce who you are
- Genuinely admire one or two specific things about the {recipient_name}'s personal context
- Clearly ask about a potential {role_type} opportunity
- End by asking for a short (15-minute) chat or career advice
- Be informal, warm, and human — but concise
- Do **not** mention where you found their profile or say "I came across you through..."

Write the email below:
"""
)

def generate_email(profile):
    linkedin = profile["linkedin"]
    user_info = profile.get("user_info", {})
    context = user_info.get("persona_context", "").strip()

    messages = []

    # Optional persona context as a system message
    if context:
        messages.append(SystemMessage(content=f"Write as someone who values: {context}"))

    messages.append(HumanMessage(
        content=email_prompt_template.format(
            user_name=user_info.get("name", "Your Name"),
            user_intro=user_info.get("intro", "a student"),
            persona_context=context,
            internship_interest=profile.get("internship_interest", "your field"),
            recipient_name=profile.get("recipient_name", "there"),
            headline=linkedin.get("headline", ""),
            bio=linkedin["details"].get("bio", ""),
            experiences=", ".join(linkedin["details"].get("experiences", [])),
            education=", ".join(linkedin["details"].get("education", [])),
            bio_page=profile.get("bio_page", ""),
            company_values=profile.get("values_page", ""),
            company_of_interest=profile.get("company_of_interest", "the company"),
            role_type=profile.get("role_type", "internship")
        )
    ))

    return llm(messages).content
