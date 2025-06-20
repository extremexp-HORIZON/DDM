# routes/user.py

from flask import request
from flask_restx import Namespace, Resource, fields
from extensions.db import db
from models.user import User
import os

user_ns = Namespace('user', description='User-related operations')

UPLOAD_FOLDER = './uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

user_profile_model = user_ns.model("UserProfileUpdate", {
    "public_key": fields.String(description="Ethereum Public Key", required=False),
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

from flask import send_from_directory

@user_ns.route('/user/profile_pic/<string:filename>')
class UserProfilePictureResource(Resource):
    @user_ns.doc(description="Serve uploaded profile picture", security='oauth2')
    def get(self, filename):
        """Serve uploaded profile picture"""
        return send_from_directory(UPLOAD_FOLDER, filename)
