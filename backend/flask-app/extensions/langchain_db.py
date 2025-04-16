from langchain.sql_database import SQLDatabase
from config import Config

db = SQLDatabase.from_uri(Config.DATABASE_URI)
