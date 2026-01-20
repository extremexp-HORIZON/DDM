# routes/user.py

from flask import request
from flask_restx import Namespace, Resource, fields
from extensions.db import db
from sqlalchemy import func
from models.user import User
import os
from flask import send_from_directory
from auth.auth import get_current_username
from models.user import UserNotification, PreferredQuery

user_ns = Namespace('user', description='User-related operations')

UPLOAD_FOLDER = './uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

user_profile_model = user_ns.model("UserProfileUpdate", {
    "public_key": fields.String(description="Ethereum Public Key", required=False),
})

notification_model = user_ns.model("UserNotification", {
    "id": fields.Integer(readOnly=True),
    "user_sub": fields.String(description="User's subject (sub)"),
    "kind": fields.String(description="Notification kind"),
    "network": fields.String,
    "contract_address": fields.String,
    "suite_id": fields.Integer,
    "dataset_fingerprint": fields.String,
    "tx_hash": fields.String,
    "event_id": fields.Integer,
    "payload": fields.Raw,
    "is_read": fields.Boolean,
    "created_at": fields.String,
    "read_at": fields.String,
})

notification_list_model = user_ns.model("UserNotificationList", {
    "data": fields.List(fields.Nested(notification_model)),
    "total": fields.Integer,
    "unread": fields.Integer,
})


preferred_query_create_model = user_ns.model("PreferredQueryCreate", {
    "name": fields.String(required=False, description="Optional name for the saved query"),
    "query": fields.Raw(required=True, description="QueryBuilder JSON object"),
})

preferred_query_model = user_ns.model("PreferredQuery", {
    "id": fields.Integer(readOnly=True),
    "user_sub": fields.String,
    "name": fields.String,
    "query": fields.Raw,
    "created_at": fields.String,
})

preferred_query_list_model = user_ns.model("PreferredQueryList", {
    "data": fields.List(fields.Nested(preferred_query_model)),
    "total": fields.Integer,
})


@user_ns.route("/user/profile/<string:username>")
class UserProfileResource(Resource):
    @user_ns.doc(description="Get user's profile by username.", security='oauth2')
    def get(self, username):
        """Fetch a user's profile"""
        user = User.query.filter_by(username=username).first_or_404()
        return {"user": user.to_json()}, 200

    @user_ns.doc(description="Update user's profile picture and/or public key.", security='oauth2')
    @user_ns.expect(user_profile_model)
    def post(self, username):
        """Update public key and optionally profile picture"""
        user = User.query.filter_by(username=username).first_or_404()

        data = request.form
        file = request.files.get("profile_pic")

        if "public_key" in data:
            user.public_key = data["public_key"]

        if file:
            filename = f"{username}.png"
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            file.save(filepath)
            user.profile_pic = f"uploads/{filename}"

        db.session.commit()
        return {
            "message": "User updated successfully",
            "user": user.to_json()
        }, 200


@user_ns.route('/user/profile_pic/<string:filename>')
class UserProfilePictureResource(Resource):
    @user_ns.doc(description="Serve uploaded profile picture", security='oauth2')
    def get(self, filename):
        """Serve uploaded profile picture"""
        return send_from_directory(UPLOAD_FOLDER, filename)

@user_ns.route("/user/notifications")
class UserNotificationsResource(Resource):
    @user_ns.doc(
        description="List notifications for the current user",
        security='oauth2',
        params={
            "onlyUnread": "If 'true', return only unread notifications",
            "limit": "Max notifications to return (default 50)",
        },
    )
    @user_ns.marshal_with(notification_list_model)
    def get(self):
        """List notifications for the logged-in user."""
        username = get_current_username()
        user = User.query.filter_by(username=username).first_or_404()

        only_unread = request.args.get("onlyUnread", "false").lower() == "true"
        try:
            limit = int(request.args.get("limit", 50))
        except ValueError:
            limit = 50

        q = UserNotification.query.filter_by(user_sub=user.sub).order_by(
            UserNotification.created_at.desc()
        )

        if only_unread:
            q = q.filter_by(is_read=False)

        notifications = q.limit(limit).all()
        total = UserNotification.query.filter_by(user_sub=user.sub).count()
        unread = (
            UserNotification.query
            .filter_by(user_sub=user.sub, is_read=False)
            .count()
        )

        return {
            "data": [n.to_json() for n in notifications],
            "total": total,
            "unread": unread,
        }
@user_ns.route("/user/notifications/<int:notification_id>/read")
class UserNotificationReadResource(Resource):
    @user_ns.doc(
        description="Mark a single notification as read",
        security='oauth2'
    )
    def post(self, notification_id):
        username = get_current_username()
        user = User.query.filter_by(username=username).first_or_404()

        notif = (
            UserNotification.query
            .filter_by(id=notification_id, user_sub=user.sub)
            .one_or_none()
        )
        if not notif:
            return {"message": "Notification not found"}, 404

        if not notif.is_read:
            notif.is_read = True
            notif.read_at = func.now()
            db.session.commit()

        return {
            "message": "Notification marked as read",
            "notification": notif.to_json(),
        }, 200

@user_ns.route("/user/notifications/mark_all_read")
class UserNotificationsMarkAllRead(Resource):
    @user_ns.doc(
        description="Mark all notifications for current user as read",
        security='oauth2'
    )
    def post(self):
        username = get_current_username()
        user = User.query.filter_by(username=username).first_or_404()

        q = UserNotification.query.filter_by(user_sub=user.sub, is_read=False)
        updated = q.update(
            {"is_read": True, "read_at": func.now()},
            synchronize_session=False,
        )
        db.session.commit()

        return {"message": f"Marked {updated} notifications as read"}


@user_ns.route("/user/queries")
class UserPreferredQueriesResource(Resource):
    @user_ns.doc(
        description="List or create preferred queries for the current user",
        security="oauth2",
        params={"limit": "Max items (default 50)"},
    )
    @user_ns.marshal_with(preferred_query_list_model)
    def get(self):
        username = get_current_username()
        user = User.query.filter_by(username=username).first_or_404()

        try:
            limit = int(request.args.get("limit", 50))
        except ValueError:
            limit = 50

        q = (PreferredQuery.query
             .filter_by(user_sub=user.sub)
             .order_by(PreferredQuery.created_at.desc()))

        rows = q.limit(limit).all()
        total = PreferredQuery.query.filter_by(user_sub=user.sub).count()

        return {"data": [r.to_json() for r in rows], "total": total}, 200

    @user_ns.doc(description="Save a preferred query", security="oauth2")
    @user_ns.expect(preferred_query_create_model, validate=True)
    def post(self):
        username = get_current_username()
        user = User.query.filter_by(username=username).first_or_404()

        payload = request.json or {}
        query_obj = payload.get("query")
        name = payload.get("name")

        if not query_obj:
            return {"message": "Missing 'query' in request body"}, 400

        row = PreferredQuery(
            user_sub=user.sub,
            name=name,
            query_json=query_obj,
        )
        db.session.add(row)
        db.session.commit()

        return {"message": "Query saved", "query": row.to_json()}, 200

@user_ns.route("/user/queries/<int:query_id>/delete")
class UserPreferredQueryDeleteResource(Resource):
    @user_ns.doc(description="Delete a preferred query", security="oauth2")
    def post(self, query_id):
        username = get_current_username()
        user = User.query.filter_by(username=username).first_or_404()

        row = (PreferredQuery.query
               .filter_by(id=query_id, user_sub=user.sub)
               .one_or_none())

        if not row:
            return {"message": "Saved query not found"}, 404

        db.session.delete(row)
        db.session.commit()

        return {"message": "Query deleted", "id": query_id}, 200
