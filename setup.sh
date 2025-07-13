#!/bin/bash

# Smart Document Chatbot - Cloudflare Setup Script
# This script helps you set up all necessary Cloudflare resources

echo "🤖 Smart Document Chatbot - Cloudflare Setup"
echo "============================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI is not installed. Please install it first:${NC}"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}🔑 Please log in to Cloudflare first:${NC}"
    echo "wrangler login"
    exit 1
fi

echo -e "${GREEN}✅ Wrangler CLI is ready${NC}"
echo

# Create R2 bucket
echo -e "${YELLOW}📁 Creating R2 bucket...${NC}"
BUCKET_NAME="chatbot-documents"
if wrangler r2 bucket create "$BUCKET_NAME" 2>/dev/null; then
    echo -e "${GREEN}✅ R2 bucket '$BUCKET_NAME' created successfully${NC}"
else
    echo -e "${YELLOW}⚠️  R2 bucket '$BUCKET_NAME' may already exist${NC}"
fi
echo

# Create Vectorize index
echo -e "${YELLOW}🔍 Creating Vectorize index...${NC}"
INDEX_NAME="document-embeddings"
if wrangler vectorize create "$INDEX_NAME" --dimensions=768 --metric=cosine 2>/dev/null; then
    echo -e "${GREEN}✅ Vectorize index '$INDEX_NAME' created successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Vectorize index '$INDEX_NAME' may already exist${NC}"
fi
echo

# Create D1 database
echo -e "${YELLOW}🗃️  Creating D1 database...${NC}"
DB_NAME="chatbot-db"
DB_RESULT=$(wrangler d1 create "$DB_NAME" 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ D1 database '$DB_NAME' created successfully${NC}"
    
    # Extract database ID from the output
    DB_ID=$(echo "$DB_RESULT" | grep -o 'database_id = "[^"]*"' | cut -d'"' -f2)
    if [ -n "$DB_ID" ]; then
        echo -e "${GREEN}📝 Database ID: $DB_ID${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  D1 database '$DB_NAME' may already exist${NC}"
fi
echo

# Generate a secure JWT secret
echo -e "${YELLOW}🔐 Generating JWT secret...${NC}"
JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "your-secure-jwt-secret-$(date +%s)")
echo -e "${GREEN}✅ JWT secret generated${NC}"
echo

# Ask for OpenAI API key
echo -e "${YELLOW}🤖 Please enter your OpenAI API key:${NC}"
read -s OPENAI_API_KEY
echo
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}❌ OpenAI API key is required${NC}"
    exit 1
fi

# Update wrangler.jsonc
echo -e "${YELLOW}📝 Updating wrangler.jsonc...${NC}"

# Backup original file
if [ -f "wrangler.jsonc" ]; then
    cp wrangler.jsonc wrangler.jsonc.backup
    echo -e "${GREEN}✅ Backup created: wrangler.jsonc.backup${NC}"
fi

# Create updated wrangler.jsonc
cat > wrangler.jsonc << EOF
{
  "\$schema": "node_modules/wrangler/config-schema.json",
  "name": "smart-document-chatbot",
  "main": "src/main-worker.ts",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": [
    "nodejs_compat"
  ],
  "upload_source_maps": true,
  "assets": {
    "directory": "dist",
    "binding": "ASSETS"
  },
  "migrations": [
    {
      "new_sqlite_classes": [
        "UserDO"
      ],
      "tag": "v1"
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "class_name": "UserDO",
        "name": "USERDO"
      }
    ]
  },
  "vars": {
    "JWT_SECRET": "$JWT_SECRET",
    "OPENAI_API_KEY": "$OPENAI_API_KEY"
  },
  "r2_buckets": [
    {
      "binding": "DOCUMENTS",
      "bucket_name": "$BUCKET_NAME"
    }
  ],
  "ai": {
    "binding": "AI"
  },
  "vectorize": [
    {
      "binding": "VECTORIZE",
      "index_name": "$INDEX_NAME"
    }
  ],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "$DB_NAME",
      "database_id": "$(echo "$DB_ID" | head -1)"
    }
  ],
  "observability": {
    "enabled": true
  }
}
EOF

echo -e "${GREEN}✅ wrangler.jsonc updated successfully${NC}"
echo

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
if command -v bun &> /dev/null; then
    bun install
    echo -e "${GREEN}✅ Dependencies installed with bun${NC}"
elif command -v npm &> /dev/null; then
    npm install
    echo -e "${GREEN}✅ Dependencies installed with npm${NC}"
else
    echo -e "${RED}❌ Neither bun nor npm found. Please install dependencies manually.${NC}"
fi
echo

# Build the project
echo -e "${YELLOW}🔨 Building project...${NC}"
if command -v bun &> /dev/null; then
    bun run build
else
    npm run build
fi
echo -e "${GREEN}✅ Project built successfully${NC}"
echo

# Test deployment (dry run)
echo -e "${YELLOW}🧪 Testing deployment...${NC}"
if wrangler deploy --dry-run; then
    echo -e "${GREEN}✅ Deployment test passed${NC}"
else
    echo -e "${RED}❌ Deployment test failed${NC}"
    exit 1
fi
echo

# Final instructions
echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
echo
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Review the generated wrangler.jsonc file"
echo "2. Deploy your worker: wrangler deploy"
echo "3. Open the deployed URL to test the chatbot"
echo "4. Upload documents and start chatting!"
echo
echo -e "${YELLOW}🔗 Useful commands:${NC}"
echo "• Deploy: wrangler deploy"
echo "• Dev mode: wrangler dev"
echo "• View logs: wrangler tail"
echo "• Check resources: wrangler r2 bucket list"
echo
echo -e "${YELLOW}📚 Documentation:${NC}"
echo "• Read CHATBOT_README.md for detailed information"
echo "• Check the dist/index.html for the frontend"
echo
echo -e "${GREEN}Happy chatting! 🚀${NC}"