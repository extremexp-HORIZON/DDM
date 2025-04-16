from langchain_community.llms import Ollama

# ⚠️ Initialize globally (do NOT do this per request)
llm = Ollama(model="mistral", base_url="http://ollama:11434")

