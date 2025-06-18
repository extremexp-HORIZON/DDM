from langchain_community.llms import Ollama
from config import Config

llm = Ollama(model=Config.OLLAMA_MODEL, base_url=Config.OLLAMA_BASE_URL)

