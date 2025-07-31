# Use Node.js base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Expose the app port
EXPOSE 3000

# Run the app
# CMD ["node", "index.js"]
#in order to run many instances and manage load on server I use pm2 
CMD ["npx", "pm2-runtime", "ecosystem.config.js"]

