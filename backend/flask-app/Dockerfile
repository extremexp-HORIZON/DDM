# Use Python base image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies including Nginx and Gunicorn
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Create the GX directory before running initialization
RUN mkdir -p /app/great_expectations && chmod -R 777 /app/great_expectations

# Ensure GX initializes properly (generate config if missing)
RUN great_expectations --v3-api init && \
    cp -r ~/.great_expectations/* /app/great_expectations/ || true


# Install Gunicorn for running Flask with a production server
RUN pip install gunicorn

# Install Nginx
RUN apt-get update && apt-get install -y nginx
# Copy application code into the container
COPY . /app/

# Copy the Nginx config file into the container
# COPY nginx.conf /etc/nginx/nginx.conf

# Expose Flask API port (Flask's default port)
EXPOSE 5001


CMD ["sh", "-c", "exec gunicorn -k eventlet -w 4 -b 0.0.0.0:5001 --timeout 60 wsgi:app"]


