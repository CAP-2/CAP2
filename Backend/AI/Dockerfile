# Step 1: Use official Node.js image as base
FROM node:20-alpine AS builder

# Step 2: Set working directory
WORKDIR /app

# Step 3: Copy package files and install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Step 4: Copy source code and build
COPY . .
RUN npm run build

# Step 5: Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built assets and production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
RUN npm install --omit=dev --legacy-peer-deps


# Expose the AI service port
EXPOSE 4000

# Start the application
CMD ["npm", "start"]
