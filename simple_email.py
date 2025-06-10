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

simple_email_prompt_template = PromptTemplate(
    input_variables=["user_name", "user_intro", "internship_interest", "recipient_name", "company_of_interest"],
    template="""
You are {user_name}, and you're reaching out to someone named {recipient_name} who works at {company_of_interest}.

You are {user_intro}, and you're currently exploring internship opportunities in {internship_interest}.

Write a concise and friendly cold email asking for a 15-minute coffee chat. The goal is to learn about the recipient's path and experience, and to ask for any advice as you apply for internships. 

Keep the tone professional but warm. Include:
- a brief introduction
- mention of your interest in the company
- a direct ask for a 15-minute chat
- gratitude and polite closing

Output ONLY the email body (no subject line, no quotes).
"""
)

def generate_simple_email(profile):
    user_info = profile.get("user_info", {})

    prompt = simple_email_prompt_template.format(
        user_name=user_info.get("name", "Your Name"),
        user_intro=user_info.get("intro", "a student"),
        internship_interest=profile.get("internship_interest", "your field"),
        recipient_name=profile.get("recipient_name", "there"),
        company_of_interest=profile.get("company_of_interest", "the company"),
    )

    response = llm([HumanMessage(content=prompt)])
    return response.content
