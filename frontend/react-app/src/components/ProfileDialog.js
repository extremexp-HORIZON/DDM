// components/ProfileDialog.js
import React, { useState, useEffect } from "react";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { FileUpload } from "primereact/fileupload";
import { useMetamaskContext } from "../context/MetamaskContext";
import { useUserProfile } from "../hooks/useUserProfile";


export const ProfileDialog = ({ visible, onHide, user }) => {
  const { wallet, connect, disconnect } = useMetamaskContext();
  const { updateProfile, loading } = useUserProfile(user);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (user) {
      setName(user.given_name || "");
      setUsername(user.preferred_username || "");
      setFamilyName(user.family_name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!user?.preferred_username) return;

    await updateProfile({
      username: user.preferred_username,
      wallet,
      image,
    });

    onHide();
  };


  return (
    <Dialog header="User Profile" visible={visible} style={{ width: "30rem" }} onHide={onHide}>
      <div className="p-fluid">
          <div className="field mb-3">
          <label>Username</label>
          <InputText value={username} readOnly />
        </div>
        <div className="field mb-3">
          <label>Name</label>
          <InputText value={name} readOnly />
        </div>

        <div className="field mb-3">
          <label>SurName</label>
          <InputText value={familyName} readOnly />
        </div>

        <div className="field mb-3">
          <label>Email</label>
          <InputText value={email} readOnly />
        </div>

        <div className="field mb-3">
          <label>Public Key (Wallet)</label>
          <div className="flex align-items-center gap-2">
            <InputText value={wallet || ""} readOnly className="flex-1" />
            {wallet ? (
              <Button
                icon="pi pi-times"
                className="p-button-rounded p-button-text"
                onClick={disconnect}
                tooltip="Clear Wallet"
              />
            ) : (
              <Button
                icon="pi pi-wallet"
                className="p-button-rounded p-button-text"
                onClick={connect}
                tooltip="Connect MetaMask"
              />
            )}
          </div>
        </div>
        <div className="field mb-3">
          <label>Upload Avatar</label>
          <div className="flex align-items-center gap-3">
            {(image || user?.profile_pic) && (
              <img
                src={image ? URL.createObjectURL(image) : user.profile_pic}
                alt="Avatar Preview"
                style={{
                  width: "4rem",
                  height: "4rem",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #ccc"
                }}
              />
            )}

            <FileUpload
              mode="basic"
              name="avatar"
              accept="image/*"
              customUpload
              chooseLabel="Upload"
              onSelect={(e) => setImage(e.files[0])}
            />
          </div>
        </div>


        <div className="mt-3 flex justify-content-end gap-2">
          <Button label="Cancel" icon="pi pi-times" className="p-button-secondary" onClick={onHide} />
          <Button
            label="Save"
            icon="pi pi-check"
            onClick={handleSave}
            disabled={loading}
            loading={loading}
            autoFocus
          />
        </div>
      </div>
    </Dialog>
  );
};
