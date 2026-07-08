FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY services/assistant-runtime/pyproject.toml /app/services/assistant-runtime/pyproject.toml
COPY services/assistant-runtime/src /app/services/assistant-runtime/src
COPY services/assistant-runtime/migrations /app/services/assistant-runtime/migrations

RUN python -m pip install --upgrade pip \
  && python -m pip install /app/services/assistant-runtime

EXPOSE 8000

CMD ["assistant-api"]
