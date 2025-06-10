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
    input_variables=["user_intro", "company_of_interest"],
    template="""
You are {user_intro}, and you're reaching out to the company {company_of_interest} about {internship}.

Write a short, fun, and professional subject line (no more than 10 words) for a cold email expressing your interest in a potential internship. 
Make it fun and witty, because we're trying to get clicks of our emails.
- Be inviting — not generic, formal, or clickbait
Output ONLY the subject line.
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
        internship=internship_interest
    )

    messages = [HumanMessage(content=prompt)]
    return llm(messages).content.strip()
