const IMG_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const VID_EXT = new Set(["mp4", "webm", "mov"]);

const extOf = (name) => {
  const p = name.toLowerCase().split(".");
  return p.length > 1 ? p[p.length - 1] : "";
};

export const githubFolderUrl = (owner, repo, ref, folderPath) =>
  `https://github.com/${owner}/${repo}/tree/${ref}/${folderPath}`;

export async function listGithubFolderMedia({ owner, repo, ref, folderPath }) {
  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${folderPath}?ref=${ref}`;
    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    if (!res.ok) {
      return { images: [], videos: [], error: `HTTP ${res.status}` };
    }

    const items = await res.json();
    if (!Array.isArray(items)) {
      return { images: [], videos: [], error: "Not a folder" };
    }

    const images = [];
    const videos = [];

    for (const it of items) {
      if (!it || it.type !== "file") continue;
      const ext = extOf(it.name);
      if (IMG_EXT.has(ext)) {
        images.push({
          name: it.name,
          raw: it.download_url, // raw file
          html: it.html_url, // github page
        });
      } else if (VID_EXT.has(ext)) {
        videos.push({
          name: it.name,
          raw: it.download_url,
          html: it.html_url,
        });
      }
    }

    return { images, videos, error: null };
  } catch (e) {
    return { images: [], videos: [], error: e?.message || "fetch failed" };
  }
}
