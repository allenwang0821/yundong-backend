# Use Node.js 16 LTS as base image
FROM node:16-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Expose port (CloudBase uses 8080)
EXPOSE 8080

# Start application
CMD ["npm", "start"] 