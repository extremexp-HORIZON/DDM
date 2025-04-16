# Use an official Node.js runtime as a parent image
FROM node:21-alpine
ENV NODE_ENV=development
# Set the working directory in the container
WORKDIR /react-app/src/app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install dependencies (including web-vitals and any missing babel plugin)
RUN npm install
RUN npm install web-vitals @babel/plugin-proposal-private-property-in-object --save-dev

# Copy the rest of the application
COPY . .

# Expose the port the app will run on
EXPOSE 3001

# Run the app
CMD ["npm", "start", "dev"]
