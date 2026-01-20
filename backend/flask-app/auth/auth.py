import requests
from functools import wraps
from flask import request, jsonify
import logging
from models.user import User
from extensions.db import db
from flask import g

logger = logging.getLogger(__name__)

class UserAuthHandler(object):
    def __init__(self):
        self.userAuthUrl = "http://access-control-service:5521/extreme_auth/api/v1/person/userinfo"

    def verify_user(self, token):
        if not token.startswith("Bearer "):
            return {"valid": False, "error_type": "invalid_format"}

        try:
            r = requests.get(url=self.userAuthUrl, headers={"Authorization": token})
            status = r.status_code
            try:
                data = r.json()
            except ValueError:
                logger.error(f"❌ Auth service returned non-JSON response: {r.text}")
                return {"valid": False, "error_type": "invalid_response"}
        except requests.RequestException as e:
            logger.exception("❌ Failed to reach auth service")
            return {"valid": False, "error_type": "request_error"}

        logger.debug(f"✅ UserAuthHandler.verify_user: status={status}, data={data}")

        if status == 200:
            return {"valid": True, "user_info": data}
        else:
            return {"valid": False, "error_type": data.get("type", "unknown_error")}


userAuthHandler = UserAuthHandler()


def ensure_user_exists(user_info):
    sub = user_info["sub"]
    user = User.query.get(sub)

    if not user:
        user = User(
            sub=sub,
            username=user_info.get("preferred_username", "unknown"),
            email=user_info.get("email"),
            public_key=None 
        )
        db.session.add(user)
        db.session.commit()

    return user


def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Missing token"}), 401

        result = userAuthHandler.verify_user(auth_header)
        if not result["valid"]:
            return jsonify({"error": "Unauthorized", "type": result["error_type"]}), 401

        user = ensure_user_exists(result["user_info"])
        request.user = user  # Attach full user object
        return f(*args, **kwargs)

    return decorated_function


def get_current_user() -> User:
    """Returns the current authenticated user model or None."""
    return g.get("current_user", None)

def get_current_user_id() -> str:
    """Returns the current authenticated user's ID (sub) or None."""
    return g.get("current_user_id", None)

def get_current_username() -> str:
    """Returns the current authenticated user's username or None."""
    return g.get("current_username", None)
