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
