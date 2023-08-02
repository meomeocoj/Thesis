# A social login solution for Web3 using Shamir’s secret sharing and verified DKG

## Prerequisite

[NodeJs](https://nodejs.org/en) version >= 14.6.1

PORT 9001, 9002, 9003, 9004, 9005, 3000 avaiable

Installing [Rust](https://rustup.rs/):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Installing [Wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

```
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

## Setup

### Executor

Create env file:

```bash
cd web3-login/services/executor
cp -f .env.example .env

```

Input the MNEMONIC in .env: "fish almost output blossom tongue village elevator control balance actor excess length"

Start the executors:

```bash
npm install
npm run spawm

```

### Build SDK

```bash
cd web3-login
npm install
npm run bootstrap
npm run dev

```

### Run example

Wait until the dev build process finish

```
cd web3-login/packages/example
npm install
npm run start

```

It will start the react-js app and redirect to http://localhost:3000, please make sure the port 3000 avaiable.
