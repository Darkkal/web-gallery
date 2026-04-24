FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app

# Install dependencies for scrapers
RUN apk add --no-cache python3 py3-pip ffmpeg && \
    pip3 install --no-cache-dir gallery-dl yt-dlp --break-system-packages

COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY . .
EXPOSE 3000
RUN chown -R node /usr/src/app
USER node
CMD ["npm", "start"]
