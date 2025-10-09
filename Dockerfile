FROM node:23-slim

# Prismaに必要なOpenSSLと依存関係をインストール
RUN apt-get update -y && \
    apt-get install -y openssl libssl3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# Prismaクライアントを生成
RUN npx prisma generate

# Set default environment variables for build
ENV NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:8080/oauth
ENV NEXT_PUBLIC_BASE_URL=http://localhost:8080
ENV NEXT_PUBLIC_GAS_INTERACTIONS_URL=https://script.google.com/macros/s/placeholder/exec
ENV SLACK_SIGNING_SECRET=placeholder_secret
ENV NODE_ENV=production
RUN yarn build

EXPOSE 8080
ENV PORT=8080
CMD ["yarn", "start"]
