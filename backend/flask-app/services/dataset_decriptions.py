from langchain_community.llms import Ollama
import traceback
# ⚠️ Initialize this ONCE globally (not per request!)
from extensions.llm import llm



def generate_descriptions_batch(df):
    columns = df.columns.tolist()
    prompt_parts = ["You are a helpful data assistant. Describe the meaning of each column in a dataset in one short sentence.\n"]

    for col in columns:
        values = df[col].dropna().astype(str).unique()[:2]
        example_values = ', '.join(map(str, values))
        prompt_parts.append(f"Column: {col}\nExamples: {example_values}")

    prompt_parts.append("\nRespond with each column name followed by a brief description.")
    prompt = "\n\n".join(prompt_parts)

    try:
        result = llm.invoke(prompt)  # 🧠 LangChain handles API calls and retries
        descriptions = {}
        for line in result.split("\n"):
            if ":" in line:
                col_name, desc = line.split(":", 1)
                descriptions[col_name.strip()] = desc.strip()
        return descriptions
    except Exception:
        print("❌ Failed to generate batch column descriptions.")
        traceback.print_exc()
        return {}
