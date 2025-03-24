FROM node:18-slim

# Create app directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy app source code
COPY . .

# Create directory for feedback logs
RUN mkdir -p src/feedback

# Set environment variable for port
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Start the app
CMD ["node", "src/index.js"] 