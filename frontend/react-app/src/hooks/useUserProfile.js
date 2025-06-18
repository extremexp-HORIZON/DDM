// hooks/useUserProfile.js
import { useState, useEffect } from "react";
import { USER_API } from "../api/user";

export const useUserProfile = (initialUser) => {
  const [profile, setProfile] = useState({
    public_key: initialUser?.public_key || "",
    profile_pic: "",
  });
  const [loading, setLoading] = useState(false);
  const username = initialUser?.preferred_username;

  useEffect(() => {
    if (!username) return;

    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { user } = await USER_API.fetchUserProfile(username);

        let profilePicUrl = "";
        if (user.profile_pic) {
          const isAlreadyBlob = user.profile_pic.startsWith("blob:");
          const isAlreadyFullURL = user.profile_pic.startsWith("http");

          if (!isAlreadyBlob && !isAlreadyFullURL) {
            const filename = user.profile_pic.replace("uploads/", "");
            profilePicUrl = await USER_API.fetchProfilePicBlob(filename);
          } else {
            profilePicUrl = user.profile_pic;
          }
        }


        setProfile({
          public_key: user.public_key,
          profile_pic: profilePicUrl,
        });
      } catch (err) {
        console.error("Failed to load user profile", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  const updateProfile = async ({ username, wallet, image }) => {
    setLoading(true);
    try {
      const formData = new FormData();
      if (wallet) formData.append("public_key", wallet);
      if (image) formData.append("profile_pic", image);

      const updated = await USER_API.updateUserProfile(username, formData);

      let profilePicUrl = "";
      if (updated.user.profile_pic) {
        const filename = updated.user.profile_pic.replace("uploads/", "");
        profilePicUrl = await USER_API.fetchProfilePicBlob(filename);
      }

      setProfile({
        public_key: updated.user.public_key,
        profile_pic: profilePicUrl,
      });
    } catch (err) {
      console.error("Failed to update profile", err);
    } finally {
      setLoading(false);
    }
  };

  return { profile, updateProfile, loading };
};
