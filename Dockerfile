FROM python:3.11-slim

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN chmod +x start_app.sh

EXPOSE 8000

CMD ["sh","start_app.sh"]