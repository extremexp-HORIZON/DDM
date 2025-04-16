import os
import zipfile
import tarfile
import pandas as pd
import geopandas as gpd



SUPPORTED_EXTENSIONS = [
    ".csv", ".xlsx", ".xls", ".json", ".xml", ".parquet", ".orc", ".dta",  # tabular
    ".feather", ".h5", ".hdf5", ".pkl", ".pickle", ".sas7bdat", ".xpt",    # binary/tabular
    ".gz", ".bz2", ".xz",                                                  # compressed CSV
    ".zip", ".tar", ".tgz", ".tar.gz",                                     # archives
    ".shp", ".geojson", ".gpkg", ".kml",                                   # geospatial (main file)
    ".shx", ".dbf", ".prj", ".cpg"                                         # ⛓️ Shapefile sidecar files (used with .shp)
]



def load_dataframe(file_path):
    ext = os.path.splitext(file_path)[1].lower()

    def _load_supported_file(fobj, filename):
        try:
            if filename.endswith(".csv"):
                return pd.read_csv(fobj)
            elif filename.endswith((".xlsx", ".xls")):
                return pd.read_excel(fobj)
            elif filename.endswith(".json"):
                try:
                    return pd.read_json(fobj)
                except Exception:
                    fobj.seek(0)
                    return pd.read_json(fobj, lines=True)
            elif filename.endswith(".parquet"):
                return pd.read_parquet(fobj)
            elif filename.endswith(".xml"):
                return pd.read_xml(fobj)
            elif filename.endswith(".orc"):
                return pd.read_orc(fobj)
            elif filename.endswith(".dta"):
                return pd.read_stata(fobj)
            elif filename.endswith(".feather"):
                return pd.read_feather(fobj)
            elif filename.endswith((".h5", ".hdf5")):
                return pd.read_hdf(fobj)
            elif filename.endswith((".pkl", ".pickle")):
                return pd.read_pickle(fobj)
            elif filename.endswith((".sas7bdat", ".xpt")):
                return pd.read_sas(fobj)
            elif filename.endswith((".shp", ".geojson", ".gpkg", ".kml")):
                return gpd.read_file(fobj).drop(columns="geometry", errors="ignore")
        except Exception as e:
            return f"Failed to load file from archive: {e}"

        return f"Unsupported file type inside archive: {filename}"

    try:
        if ext == ".csv":
            return pd.read_csv(file_path, sep=None, skipinitialspace=True, encoding="utf-8-sig", engine="python")

        elif ext in [".xlsx", ".xls"]:
            return pd.read_excel(file_path)

        elif ext == ".json":
            try:
                return pd.read_json(file_path)
            except ValueError:
                return pd.read_json(file_path, lines=True)

        elif ext == ".parquet":
            return pd.read_parquet(file_path)

        elif ext == ".xml":
            return pd.read_xml(file_path)

        elif ext == ".orc":
            return pd.read_orc(file_path)

        elif ext == ".dta":
            return pd.read_stata(file_path)

        elif ext == ".feather":
            return pd.read_feather(file_path)

        elif ext in [".h5", ".hdf5"]:
            return pd.read_hdf(file_path)

        elif ext in [".pkl", ".pickle"]:
            return pd.read_pickle(file_path)

        elif ext in [".sas7bdat", ".xpt"]:
            return pd.read_sas(file_path)

        elif ext in [".shp", ".geojson", ".gpkg", ".kml"]:
            return gpd.read_file(file_path).drop(columns="geometry", errors="ignore")

        elif ext in [".gz", ".bz2", ".xz"]:
            return pd.read_csv(file_path, compression=ext[1:])

        elif ext == ".zip":
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                supported = [f for f in zip_ref.namelist() if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS]
                if not supported:
                    return "No supported file found in ZIP."
                with zip_ref.open(supported[0]) as f:
                    return _load_supported_file(f, supported[0])

        elif ext in [".tar", ".tar.gz", ".tgz"]:
            with tarfile.open(file_path, "r:*") as tar:
                for member in tar.getmembers():
                    name = member.name.lower()
                    if any(name.endswith(e) for e in SUPPORTED_EXTENSIONS):
                        f = tar.extractfile(member)
                        return _load_supported_file(f, name)
                return "No supported file found in TAR."

        return f"Unsupported file extension: {ext}"

    except Exception as e:
        return f"Failed to load file ({ext}): {e}"
