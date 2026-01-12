# Deployment Guide - Backend to VPS/Hosting

## Why No Build Step?

Node.js backends run JavaScript directly - no compilation needed! Unlike frontend frameworks (React, Vue, Angular) that need to be built into static files, Express backends are ready to deploy as-is.

---

## 🚀 Deployment Options

### Option 1: VPS (DigitalOcean, AWS EC2, Linode)
### Option 2: Platform as a Service (Heroku, Railway, Render)
### Option 3: Serverless (Vercel, AWS Lambda)

---

## 📦 Pre-Deployment Checklist

1. ✅ Set `NODE_ENV=production` in environment
2. ✅ Use strong `JWT_SECRET`
3. ✅ Set up MongoDB (Atlas recommended)
4. ✅ Configure `CORS_ORIGIN` to your frontend URL
5. ✅ Set proper rate limits
6. ✅ Create `.gitignore` to exclude node_modules and .env

---

## 🖥️ VPS Deployment (Ubuntu/Linux)

### Step 1: Prepare Your VPS

```bash
# SSH into your VPS
ssh root@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (v18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx (reverse proxy)
sudo apt install nginx -y
```

### Step 2: Upload Your Code

**Option A: Git (Recommended)**
```bash
# On your local machine, push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main

# On VPS
cd /var/www
git clone https://github.com/yourusername/your-repo.git
cd your-repo/server
```

**Option B: SCP (File Transfer)**
```bash
# From your local machine
scp -r ./server root@your-server-ip:/var/www/
```

### Step 3: Install Dependencies

```bash
cd /var/www/server
npm install --production
```

### Step 4: Set Up Environment Variables

```bash
# Create .env file
nano .env
```

**Production .env:**
```env
NODE_ENV=production
PORT=5000

# MongoDB Atlas (required)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/business_management

# Strong JWT secret
JWT_SECRET=your-super-long-random-secret-key-change-this-12345678

# File uploads
MAX_FILE_SIZE=5242880
UPLOAD_PATH=/var/www/server/uploads

# Rate limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000

# CORS - your frontend URL
CORS_ORIGIN=https://yourdomain.com
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

### Step 5: Start with PM2

```bash
# Start the app
pm2 start server.js --name business-api

# Set PM2 to start on system reboot
pm2 startup
pm2 save

# Check status
pm2 status

# View logs
pm2 logs business-api
```

**Useful PM2 Commands:**
```bash
pm2 restart business-api    # Restart app
pm2 stop business-api        # Stop app
pm2 delete business-api      # Remove app
pm2 monit                    # Monitor resources
```

### Step 6: Configure Nginx (Reverse Proxy)

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/business-api
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;  # Your domain/subdomain

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Increase body size for file uploads
    client_max_body_size 10M;
}
```

**Enable the site:**
```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/business-api /etc/nginx/sites-enabled/

# Test Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 7: Set Up SSL (HTTPS) with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal test
sudo certbot renew --dry-run
```

### Step 8: Configure Firewall

```bash
# Allow necessary ports
sudo ufw allow 22      # SSH
sudo ufw allow 80      # HTTP
sudo ufw allow 443     # HTTPS
sudo ufw enable
```

**Your API is now live!** 🎉

Access it at: `https://api.yourdomain.com`

---

## 🌐 Railway Deployment (Easiest!)

Railway is perfect for quick deployments without VPS management.

### Step 1: Prepare package.json

Add production start script (already there):
```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

### Step 2: Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click **New Project** → **Deploy from GitHub repo**
4. Select your repository
5. **Add variables** in Railway dashboard:
   ```
   NODE_ENV=production
   MONGODB_URI=your-mongodb-atlas-uri
   JWT_SECRET=your-secret
   PORT=5000
   CORS_ORIGIN=https://yourfrontend.com
   ```
6. Click **Deploy**

**That's it!** Railway auto-deploys on every git push.

---

## 🔥 Render Deployment

### Step 1: Create `render.yaml`

```yaml
services:
  - type: web
    name: business-api
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: PORT
        value: 5000
```

### Step 2: Deploy

1. Push code to GitHub
2. Go to [render.com](https://render.com)
3. Click **New** → **Web Service**
4. Connect GitHub repository
5. Add environment variables
6. Click **Create Web Service**

---

## 🚢 Docker Deployment

### Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

### Create `.dockerignore`:

```
node_modules
.env
.git
*.log
```

### Build and Run:

```bash
# Build image
docker build -t business-api .

# Run container
docker run -d \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e MONGODB_URI=your-mongo-uri \
  -e JWT_SECRET=your-secret \
  --name business-api \
  business-api

# View logs
docker logs business-api
```

---

## 📊 Monitoring & Maintenance

### 1. Check Server Status

```bash
# PM2 status
pm2 status

# Server resources
htop

# Disk space
df -h

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### 2. Update Application

```bash
cd /var/www/server
git pull
npm install --production
pm2 restart business-api
```

### 3. Database Backup (MongoDB Atlas)

MongoDB Atlas automatically backs up your data. No manual setup needed!

### 4. Set Up Monitoring

**Using PM2:**
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
```

**External Services:**
- UptimeRobot - Free uptime monitoring
- Better Stack - Error tracking
- MongoDB Atlas Monitoring - Built-in

---

## 🔐 Security Checklist

- [ ] Use strong JWT_SECRET (64+ characters)
- [ ] Enable HTTPS/SSL
- [ ] Set proper CORS_ORIGIN
- [ ] Use MongoDB Atlas with IP whitelist
- [ ] Keep dependencies updated: `npm audit fix`
- [ ] Use environment variables for secrets
- [ ] Enable firewall on VPS
- [ ] Regular backups
- [ ] Monitor error logs
- [ ] Rate limiting enabled

---

## 🆘 Troubleshooting

### Server Won't Start

```bash
# Check PM2 logs
pm2 logs business-api --lines 100

# Check if port is in use
sudo lsof -i :5000

# Test manually
node server.js
```

### MongoDB Connection Failed

- Check `MONGODB_URI` is correct
- Verify MongoDB Atlas IP whitelist (add 0.0.0.0/0 for all IPs)
- Test connection string locally first

### Nginx 502 Bad Gateway

```bash
# Check if app is running
pm2 status

# Check Nginx config
sudo nginx -t

# Restart services
pm2 restart business-api
sudo systemctl restart nginx
```

---

## 📝 Environment Variables Reference

**Required:**
- `NODE_ENV` - Set to `production`
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Strong random secret
- `PORT` - Server port (default: 5000)

**Optional:**
- `CORS_ORIGIN` - Frontend URL
- `RATE_LIMIT_MAX` - Max requests per window
- `RATE_LIMIT_WINDOW_MS` - Rate limit window
- `MAX_FILE_SIZE` - Max upload size
- `UPLOAD_PATH` - Upload directory

---

## ✅ Quick Deployment Comparison

| Option | Difficulty | Cost | Best For |
|--------|-----------|------|----------|
| Railway | ⭐ Easy | $5/mo | Quick start |
| Render | ⭐ Easy | Free tier | Testing |
| VPS (DigitalOcean) | ⭐⭐⭐ Medium | $5-10/mo | Full control |
| AWS EC2 | ⭐⭐⭐⭐ Hard | Variable | Enterprise |
| Docker | ⭐⭐⭐ Medium | Depends | Scalability |

**Recommendation for beginners:** Start with Railway or Render, then move to VPS when you need more control.

---

## 🎉 Success!

Your backend is now deployed and accessible to your Flutter app!

**Next Steps:**
1. Update Flutter app to use your API URL
2. Test all endpoints with production database
3. Set up monitoring
4. Configure backups

Need help? Check the logs: `pm2 logs` or platform-specific logs.
