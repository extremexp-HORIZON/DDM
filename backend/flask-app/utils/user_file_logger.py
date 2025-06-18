from models.user import UserAction
from extensions.db import db
from flask import has_request_context, request

def log_action_with_context(username, action_type, file_id=None, metadata=None):
    action = UserAction(
        username=username,
        action_type=action_type,
        file_id=file_id,
        log_metadata=enrich_with_request_metadata(metadata or {})
    )
    db.session.add(action)
    db.session.commit()

def enrich_with_request_metadata(metadata: dict = None) -> dict:
    enriched = metadata.copy() if metadata else {}
    if has_request_context():
        enriched.update({
            "request_url": request.url,
            "user_agent": request.user_agent.string,
            "browser": request.user_agent.browser,
            "platform": request.user_agent.platform,
            "ip": request.remote_addr
        })
    return enriched
