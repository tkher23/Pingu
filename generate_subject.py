from langchain.schema import HumanMessage
from langchain.prompts import PromptTemplate
from langchain_community.chat_models import ChatOpenAI
import os
from dotenv import load_dotenv

load_dotenv()

llm = ChatOpenAI(
    model_name="gpt-3.5-turbo",
    temperature=0.85,
    openai_api_key=os.getenv("OPENAI_API_KEY")
)

subject_prompt_template = PromptTemplate(
    input_variables=["user_intro", "company_of_interest", "internship_interest"],
    template="""
You are {user_intro}, and you're reaching out to someone at {company_of_interest} because you're excited about opportunities in {internship_interest}, which may be different from your academic background.

Write a short, fun, and professional subject line (no more than 5 words) for a cold email asking to connect and chat about breaking into {internship_interest}. 
- Avoid generic, overly formal, or clickbait-y tones.
- Make it sound approachable and tailored, not templated.

Output ONLY the subject line with no quotes around it.
"""
)

def generate_subject(profile):
    user_info = profile.get("user_info", {})
    user_intro = user_info.get("intro", "a student")
    company = profile.get("company_of_interest", "this company")
    internship_interest = profile.get("internship_interest", "your field")


    prompt = subject_prompt_template.format(
        user_intro=user_intro,
        company_of_interest=company,
        internship_interest=internship_interest
    )

    messages = [HumanMessage(content=prompt)]
    return llm(messages).content.strip()
