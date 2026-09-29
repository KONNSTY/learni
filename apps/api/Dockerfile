FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY apps/api /srv/apps/api
COPY packages/contracts/schemas /srv/packages/contracts/schemas
COPY content /srv/content
RUN pip install --no-cache-dir /srv/apps/api
ENV CONTENT_DIR=/srv/content CONTRACTS_DIR=/srv/packages/contracts APP_ENV=prod
RUN useradd -r -u 10001 app && chown -R app /srv
USER app
EXPOSE 8000
# Secrets kommen ausschliesslich als Env-Variablen der Plattform, nie ins Image.
CMD ["uvicorn", "learni_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
