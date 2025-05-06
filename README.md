# DDM - Decentralized Data Management for ExtremeXP


## 🌍 Overview

This project provides a **decentralized data management (DDM)** system designed for ExtremeXP, combining:

- **Zenoh nodes 1,4** for decentralized data transport and querying
- **React** frontend  
- **Flask** backend  
- **Celery** task management  
- **PostgreSQL** storage  
- **Ollama** integration for dataset-driven insights  
- **Great Expectations** package for robust dataset validation
- **YData Profiling** for automated dataset profiling and reporting

## ⚙️ Setup Instructions

### 1️⃣ Backend Environment Configuration

Navigate to: DDM/backend/flask-app/

Copy the provided example environment file:

```bash
cp .env_example .env
```

Then edit .env and set values.

### 2️⃣ Build and Run with Docker

Make sure Docker is installed and the Docker daemon is running.

In the project root (where the docker-compose.yaml file is), run:

```bash
sudo docker compose build    # Only if you need to rebuild
sudo docker compose up -d
```

### 3️⃣ Access the Services

🌐 Frontend (React app) → http://localhost:3001

🔧 Backend (Flask Swagger docs) → http://localhost:5001/swagger


## 📸 Screenshots

<details>
<summary><strong>Catalog</strong></summary>

![Catalog Filter](demo_screenshots/catalog_filter.png)  
![Uploader Metadata](demo_screenshots/catalog_uploader_metadata.png)  
![Validate](demo_screenshots/catalog_validate.png)  
![Validation Results](demo_screenshots/catalog_validation_results.png)  
![View File Metadata](demo_screenshots/catalog_view_file_metadata.png)

</details>

<details>
<summary><strong>Uploads</strong></summary>

![Uploaded Files](demo_screenshots/uploaded_files.png)  
![Uploaded Files Metadata](demo_screenshots/uploaded_files_metadata.png)  
![Upload Chunks](demo_screenshots/upload_chunks.png)  
![Upload Chunks Merged](demo_screenshots/upload_chunks_merged.png)  
![Upload Files](demo_screenshots/upload_files.png)  
![Upload Files Metadata](demo_screenshots/upload_files_metadata.png)  
![Upload Links](demo_screenshots/upload_links.png)

</details>

<details>
<summary><strong>Expectations</strong></summary>

![Expectation Suites](demo_screenshots/expectation_suites.png)  
![Expectation Suites View](demo_screenshots/expectation_suites_view.png)  
![Set Expectations 1](demo_screenshots/set_expectations_1.png)  
![Set Expectations 2](demo_screenshots/set_expectations_2.png)  
![Set Expectations 3a](demo_screenshots/set_expectations_3a.png)  
![Set Expectations 3b](demo_screenshots/set_expectations_3b.png)  
![Set Expectations 4](demo_screenshots/set_expectations_4.png)

</details>

<details>
<summary><strong>Validations</strong></summary>

![Validation Results](demo_screenshots/validation_results.png)  
![Validation Results View](demo_screenshots/validation_results_view.png)

</details>

<details>
<summary><strong>Swagger Documentation</strong></summary>

![Swagger Docs](demo_screenshots/z_swagger_z.png)
![Swagger Docs+](demo_screenshots/z_swagger_zz.png)


</details>
