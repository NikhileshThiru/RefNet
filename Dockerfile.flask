FROM python:3.11-slim

# Install curl and clean up apt cache
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn>=21

# Copy the rest of the app
COPY . .

ENV FLASK_ENV=production

# Expose Flask port
EXPOSE 8000

# Run the app in production using Gunicorn with the factory function
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8000", "app:app"]