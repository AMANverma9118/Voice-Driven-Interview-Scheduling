import { useEffect, useState } from "react";
import { apiUrl } from "../api";

export default function Clip({ path }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let dead = false;
    let objectUrl = "";
    const token = localStorage.getItem("desk_token");
    fetch(apiUrl(path), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (dead || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      dead = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!url) return <p className="quiet">Loading the recording…</p>;
  return <audio controls preload="none" src={url} />;
}
