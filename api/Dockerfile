# Use a lean, official Python 3.11 image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy *only* the requirements file first to cache this layer
COPY requirements.txt .

# Install all dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Now, copy the rest of your application code
# (This respects your .dockerignore)
COPY . .

# CRITICAL: Cloud Run requires your app to listen on 0.0.0.0
# and it sends traffic to port 8080 by default.
ENV PORT 8080

# The command to run your app
CMD gunicorn -w 2 -k uvicorn.workers.UvicornWorker app.main:app --bind "0.0.0.0:$PORT"