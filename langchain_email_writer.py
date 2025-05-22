
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
    input_variables=["user_name", "user_intro", "persona_context", "internship_interest", "recipient_name", "headline", "bio", "experiences", "education", "bio_page", "company_values"],
    template="""  
You are {user_name}, {user_intro}, and you are very interested in a {role_type} opportunity in {internship_interest} at {company_of_interest}.

You want to send a personalized cold email to {recipient_name}, who has the following background:

- Headline: {headline}
- Bio: {bio}
- Experience: {experiences}
- Education: {education}

Their company values include:
{company_values}

You have also read their bio page:
{bio_page}

Here is some personal context about you: "{persona_context}".
Use this to explain why you are personally drawn to this company and this person — connect your values and goals to their experience and what the company stands for.

=== TASK ===
Write an email from the perspective of {user_name}. Introduce yourself briefly, say what you admire about the company and about {recipient_name}'s experience, and clearly request a {role_type} opportunity and a 15-minute meeting to ask for career advice.

This email should be:
- Informal in tone
- Around 200 words
- Start with "Dear {recipient_name}"
- Admiring and personal
- Do NOT say where you found the info or "I came across you through..."

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
