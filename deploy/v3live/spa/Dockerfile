# Non-root wrapper for the apps repo's static SPA images (vendor, admin, partner). The base image runs nginx as root on port 80; this adds no content, only ownership and a port.
#   docker build -f deploy/v3live/spa/Dockerfile --build-arg BASE_IMAGE=get4domain-vendor-base:<tag> -t get4domain-v3-vendor:<tag> deploy/v3live/spa
# The API address still comes from API_BASE_URL when the container starts (the base image's entrypoint script); nothing is baked in.
ARG BASE_IMAGE
FROM ${BASE_IMAGE}
USER root
RUN set -eu; \
    sed -i 's/listen 80 default_server;/listen 8080 default_server;/' /etc/nginx/conf.d/default.conf; \
    grep -q 'listen 8080 default_server;' /etc/nginx/conf.d/default.conf; \
    sed -i 's#^pid .*#pid /tmp/nginx.pid;#' /etc/nginx/nginx.conf; \
    grep -q '^pid /tmp/nginx.pid;' /etc/nginx/nginx.conf; \
    mkdir -p /etc/nginx/snippets /opt/g4d /var/cache/nginx; \
    chown -R nginx:nginx /usr/share/nginx/html /etc/nginx/snippets /opt/g4d /var/cache/nginx /etc/nginx/conf.d
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
