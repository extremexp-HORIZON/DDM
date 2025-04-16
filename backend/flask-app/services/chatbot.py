from langchain.chains import SQLDatabaseChain
from extensions.llm import llm
from extensions.langchain_db import db

chain = SQLDatabaseChain.from_llm(llm, db)

def chat_to_postgres(user_prompt):
    return chain.run(user_prompt)


