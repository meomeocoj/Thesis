FROM rust:alpine3.18 as base

WORKDIR /usr/src

RUN USER=root cargo new blsdkg 

# Install required dependencies
RUN apk update && \
  apk add --no-cache \
  clang \
  build-base \
  ca-certificates \
  curl \
  openssl-dev \
  zlib-dev

# Install wasm-pack
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

COPY Cargo.toml Cargo.lock /usr/src/blsdkg/

COPY src/lib.rs /usr/src/blsdkg/src/

WORKDIR /usr/src/blsdkg

RUN wasm-pack build --target nodejs


FROM node:hydrogen-alpine3.18 as bundle

WORKDIR /usr/src/executor

COPY package.json package-lock.json /usr/src/executor/

RUN npm ci --omit=dev --ignore-scripts

COPY . .

COPY --from=base /usr/src/blsdkg/pkg/ /usr/src/executor/pkg

CMD ["node", "src/index.js"]



