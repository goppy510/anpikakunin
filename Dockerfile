FROM node:23-slim

WORKDIR /app
COPY . .

RUN yarn install

CMD ["yarn", "dev", "--port", "8080"]
