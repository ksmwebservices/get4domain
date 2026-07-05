# P006 — Production Deployment
# Get4Domain Engineering Standard v1.0
# Phase: P006 | Owner: Claude Code | ONLY after full payment received

---

## PRE-CONDITIONS — ALL MUST BE TRUE BEFORE STARTING

- [ ] P005 testing complete — all builds passing
- [ ] Client has reviewed dev URL and given written approval
- [ ] Final 50% payment received (confirmed by Get4Domain admin)
- [ ] Production server provisioned (Ubuntu)
- [ ] Domain DNS configured → production server IP
- [ ] SSL certificate ready (or Let's Encrypt)

If ANY item above is unchecked — STOP. Do not deploy.

---

## TASK 1 — PRODUCTION ENVIRONMENT SETUP (SERVER)

```bash
# On Ubuntu production server
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git

sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
```

---

## TASK 2 — CREATE PRODUCTION .ENV

On the server, create `/app/{client-id}/.env.production`:
```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres:STRONG_PASSWORD@postgres:5432/{db_name}
JWT_ACCESS_SECRET={32+ char random string}
JWT_REFRESH_SECRET={32+ char random string}
CLIENT_URL=https://{production-domain}
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## TASK 3 — PRODUCTION DOCKER COMPOSE

Create `docker-compose.prod.yml` on server:
```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    restart: always
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    networks: [app_network]

  backend:
    build:
      context: ./backend
      target: production
    restart: always
    depends_on: [postgres]
    env_file: .env.production
    networks: [app_network]

  frontend:
    build:
      context: ./frontend
      target: production
    restart: always
    networks: [app_network]

networks:
  app_network:
volumes:
  postgres_data:
```

---

## TASK 4 — NGINX CONFIGURATION

```nginx
server {
    listen 80;
    server_name {production-domain};
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name {production-domain};

    ssl_certificate /etc/letsencrypt/live/{domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{domain}/privkey.pem;

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }

    location /uploads/ {
        alias /app/{client-id}/uploads/;
    }

    client_max_body_size 20M;
}
```

---

## TASK 5 — DEPLOY

```bash
# On production server
cd /app
git clone https://github.com/ksmwebservices/{repo} {client-id}
cd {client-id}

# Run migrations
docker compose -f docker-compose.prod.yml run backend npx prisma migrate deploy

# Start all services
docker compose -f docker-compose.prod.yml up --build -d

# Verify
docker compose -f docker-compose.prod.yml ps
curl https://{production-domain}/api/v1/health
```

---

## TASK 6 — BACKUP CONFIGURATION

```bash
# Create daily backup script
cat > /root/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec postgres pg_dump -U postgres {db_name} > /backups/{client-id}_$DATE.sql
find /backups -name "{client-id}_*.sql" -mtime +30 -delete
EOF
chmod +x /root/backup.sh

# Schedule: daily at 2am
echo "0 2 * * * /root/backup.sh" | crontab -
```

---

## TASK 7 — SSL CERTIFICATE

```bash
sudo certbot --nginx -d {production-domain}
sudo systemctl reload nginx
```

---

## DELIVERABLES

```
P006 — DEPLOYMENT COMPLETE
===========================
1. Server: Ubuntu, Docker, Nginx running ✅/❌
2. SSL: Certificate installed ✅/❌
3. Database: Migrations applied, seed data ✅/❌
4. Backend: Running on production ✅/❌
5. Frontend: Serving on HTTPS ✅/❌
6. Health check: https://{domain}/api/v1/health ✅/❌
7. Backups: Cron job configured ✅/❌
8. Production URL: https://{domain}
9. Admin credentials: [handed to client]

PROJECT COMPLETE — Hand over to client.
```

