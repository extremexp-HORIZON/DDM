import os

def get_file_extension(file_path):
    return os.path.splitext(file_path)[1].lower() or "unknown"

# utils/file_types.py

GROUPED_DF_SUPPORTED_EXTENSIONS = {
    "Tabular": {
        ".csv": "CSV (Comma-separated values)",
        ".xlsx": "Excel (XLSX)",
        ".xls": "Excel (XLS)",
        ".json": "JSON (JS Object Notation)",
        ".xml": "XML (eXtensible Markup Language)",
        ".parquet": "Parquet (Apache)",
        ".orc": "ORC (Optimized Row Columnar)",
        ".dta": "Stata (DTA)"
    },
    "Binary / Tabular": {
        ".feather": "Feather (Apache Arrow)",
        ".h5": "HDF5 (.h5)",
        ".hdf5": "HDF5 (.hdf5)",
        ".pkl": "Pickle (Python)",
        ".pickle": "Pickle (Python)",
        ".sas7bdat": "SAS Binary (.sas7bdat)",
        ".xpt": "SAS XPORT (.xpt)"
    },
    "Compressed CSV": {
        ".gz": "GZIP-compressed",
        ".bz2": "BZIP2-compressed",
        ".xz": "XZ-compressed"
    },
    "Archives": {
        ".zip": "ZIP archive",
        ".tar": "TAR archive",
        ".tgz": "TAR.GZ archive",
        ".tar.gz": "TAR.GZ archive"
    },
    "Geospatial (Main Files)": {
        ".shp": "Shapefile (.shp)",
        ".geojson": "GeoJSON",
        ".gpkg": "GeoPackage",
        ".kml": "KML (Google Earth)"
    },
    "Geospatial (Sidecars)": {
        ".shx": "Shapefile index (.shx)",
        ".dbf": "Shapefile DBF (.dbf)",
        ".prj": "Shapefile projection (.prj)",
        ".cpg": "Shapefile encoding (.cpg)"
    }
}


GROUPED_SUPPORTED_EXTENSIONS = {
    "Tabular": {
        ".csv": "CSV (Comma-separated values)",
        ".xlsx": "Excel (XLSX)",
        ".xls": "Excel (XLS)",
        ".json": "JSON (JS Object Notation)",
        ".xml": "XML (eXtensible Markup Lang)",
        ".parquet": "Parquet (Apache)",
        ".orc": "ORC (Optimized Row Columnar)",
        ".dta": "Stata (DTA)"
    },
    "Binary / Tabular": {
        ".feather": "Feather (Apache Arrow)",
        ".h5": "HDF5 (.h5)",
        ".hdf5": "HDF5 (.hdf5)",
        ".pkl": "Pickle (Python)",
        ".pickle": "Pickle (Python)",
        ".sas7bdat": "SAS Binary (.sas7bdat)",
        ".xpt": "SAS XPORT (.xpt)"
    },
    "Compressed CSV": {
        ".gz": "GZIP-compressed",
        ".bz2": "BZIP2-compressed",
        ".xz": "XZ-compressed"
    },
    "Archives": {
        ".zip": "ZIP archive",
        ".tar": "TAR archive",
        ".tgz": "TAR.GZ archive",
        ".tar.gz": "TAR.GZ archive"
    },
    "Geospatial (Main Files)": {
        ".shp": "Shapefile (.shp)",
        ".geojson": "GeoJSON",
        ".gpkg": "GeoPackage",
        ".kml": "KML (Google Earth)"
    },
    "Geospatial (Sidecars)": {
        ".shx": "Shapefile index (.shx)",
        ".dbf": "Shapefile DBF (.dbf)",
        ".prj": "Shapefile projection (.prj)",
        ".cpg": "Shapefile encoding (.cpg)"
    },
    "Documents": {
        ".pdf": "PDF Document",
        ".doc": "Microsoft Word (DOC)",
        ".docx": "Microsoft Word (DOCX)",
        ".odt": "OpenDocument Text",
        ".rtf": "Rich Text Format",
        ".txt": "Plain Text File",
        ".md": "Markdown File"
    },
    "Images": {
        ".png": "PNG Image",
        ".jpg": "JPEG Image",
        ".jpeg": "JPEG Image",
        ".gif": "GIF Image",
        ".bmp": "Bitmap Image",
        ".tiff": "TIFF Image",
        ".svg": "Scalable Vector Graphics"
    },
    "Videos": {
        ".mp4": "MP4 Video",
        ".mkv": "Matroska Video",
        ".mov": "QuickTime Video",
        ".avi": "AVI Video",
        ".webm": "WebM Video"
    },
    "Audio": {
        ".mp3": "MP3 Audio",
        ".wav": "WAV Audio",
        ".ogg": "OGG Audio",
        ".flac": "FLAC Audio",
        ".m4a": "M4A Audio"
    }
}
