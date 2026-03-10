# Deployment Guide

## Deploying to Vercel

This project is configured for deployment to Vercel. Follow these steps:

### Prerequisites
1. Create a [Vercel account](https://vercel.com/signup)
2. Create a [GitHub account](https://github.com/signup) (if you don't have one)

### Database Setup
Vercel's serverless platform requires a serverless-compatible database. Options include:
- **Vercel Postgres** (recommended)
- **PlanetScale** (MySQL)
- **Supabase** (PostgreSQL)
- **Neon** (PostgreSQL)

1. Create a database and get your connection string
2. Update the `DATABASE_URL` in your environment variables

### Steps to Deploy

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   # Create a new repository on GitHub, then:
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - In "Environment Variables", add:
     - `DATABASE_URL`: Your PostgreSQL connection string
   - Click "Deploy"

### Switching Database (SQLite to PostgreSQL)

The project currently uses SQLite. To switch to PostgreSQL for Vercel:

1. Update `prisma/schema.prisma` to use PostgreSQL:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Update your `.env` file with the PostgreSQL connection string

3. Run migrations:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

### Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Start development server
npm run dev
```

The app will be available at http://localhost:3000
