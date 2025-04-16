# tasks/llm_describe_columns.py

import pandas as pd
from celery import shared_task
from ..services.dataset_decriptions import generate_column_description
import logging
import json
# Configure logging to print to console and a file
logging.basicConfig(
    level=logging.DEBUG,  # Set logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),  # Print to console
        logging.FileHandler("app.log")  # Save logs to a file
    ]
)

logger = logging.getLogger(__name__)  # Get a named logger
logger = logging.getLogger(__name__)


@shared_task(ignore_result=False)
def generate_column_descriptions_from_df(serialized_df_json):
    """
    Celery task to generate LLM-based descriptions for each column in a DataFrame.
    Input: serialized DataFrame (to JSON) string.
    Output: list of {"column": ..., "description": ...}
    """

    try:
        df = pd.read_json(serialized_df_json)
        logger.info(f"📊 Loaded DataFrame with {df.shape[1]} columns")

        descriptions = []
        for col in df.columns:
            sample_values = df[col].dropna().unique().astype(str).tolist()[:5]
            other_columns = [c for c in df.columns if c != col]

            description = generate_column_description(col, sample_values, other_columns)
            logger.info(f"🧠 {col}: {description}")

            descriptions.append({
                "column": col,
                "description": description
            })

        return descriptions

    except Exception as e:
        logger.error(f"❌ Error generating column descriptions: {e}")
        return {"error": str(e)}
