FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup --system notica && adduser --system --ingroup notica notica

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chown -R notica:notica /app
USER notica

EXPOSE 8000
ENTRYPOINT ["sh", "entrypoint.sh"]
