#!/bin/sh
set -e

# Схема БД через миграции Alembic
alembic upgrade head

exec "$@"
