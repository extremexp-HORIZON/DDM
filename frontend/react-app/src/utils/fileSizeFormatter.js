export const formatFileSize = (bytes) => {
    if (bytes === 0 || bytes == null) return "0 B";
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    return `${size.toFixed(size < 10 && i > 0 ? 1 : 0)} ${sizes[i]}`;
  };