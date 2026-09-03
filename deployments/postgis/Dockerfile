# deployments/postgis/Dockerfile — PostGIS database image for Render (optional)
#
# Render's native Postgres add-on does NOT bundle PostGIS, but this backend's
# schema requires geometry(POINT, 4326) columns. This image gives you a
# PostGIS-enabled Postgres 15 as a Render private service (`pserv`), so the
# whole stack can live on Render.
#
# It is referenced (commented) from render.yaml. Uncomment the `postgis` service
# block there to provision it. The backend's DATABASE_URL / DATABASE_URL_SYNC
# should then point at `postgis:5432` (Render wires private-service DNS by name).

FROM postgis/postgis:15-3.4

# PostGIS listens on 5432 inside the container. Render exposes the port the
# container listens on; no EXPOSE is strictly required, but stating it documents
# the contract for anyone reading the image.
EXPOSE 5432

# The official image already:
#   - runs `postgres` (no external ENTRYPOINT override needed),
#   - loads the `postgis` extension template on first init,
#   - stores data under /var/lib/postgresql/data (mount a Render disk there).
# No custom init is needed for this app; the backend creates its own schema via
# `alembic upgrade head` on boot.
