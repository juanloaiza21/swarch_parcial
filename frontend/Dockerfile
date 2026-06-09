# ---- Frontend image: static SPA served by nginx (proxies /api -> backend) ----
FROM nginx:1.27-alpine

# Static assets.
COPY public /usr/share/nginx/html

# Reverse-proxy + SPA fallback config.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1
