# Vandana Mall — Backend API

## Setup (run once)
```bash
npm install
npm run db:init    # create all tables
npm run db:seed    # load 84 staff
```

## Run locally
```bash
npm run dev        # starts on port 4000
```

## Deploy to Vercel
```bash
vercel
vercel env add DATABASE_URL    # paste Neon connection string
vercel --prod
```

## Environment variables needed on Vercel
- DATABASE_URL = your Neon PostgreSQL connection string
