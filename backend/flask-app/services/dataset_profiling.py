from ydata_profiling import ProfileReport
from utils.zenoh_file_handler import ZenohFileHandler
import json
import logging

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

# 🔹 Function to generate profiling reports
def generate_profile_report(df, file_id, project_id):
    """Generates an HTML profile report for a DataFrame."""
    profile = ProfileReport(df, title="Profiling Report", minimal=True, sensitive=True, correlations=None, pool_size=1)
    profile.config.html.navbar_show = False

    profile_file_path = f"/tmp/{file_id}_profile_report.html"
    profile.to_file(profile_file_path)

    with open(profile_file_path, "r", encoding="utf-8") as f:
        profile_html = f.read()

    profile_html = profile_html.replace(
        '<p class="text-body-secondary text-end">Brought to you by <a href="https://ydata.ai/?utm_source=opensource&amp;utm_medium=ydataprofiling&amp;utm_campaign=report" target="_blank">YData</a></p>', ''
    )

    # ✅ Upload Profile Report to Zenoh
    report_name = f"{file_id}_profile_report.html"
    report_path = f"projects/{project_id}/files/{file_id}/{report_name}"

    ZenohFileHandler.put_file(
        report_path,
        json.dumps(profile_html).encode("utf-8")  # ensure it's bytes
    )

    logger.info(f"✅ Profile report stored in Zenoh at {report_path}")
    return profile_html