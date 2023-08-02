# !usr/bin/env bash

set -eux

# echo "Publishing normal package"
# npx lerna publish from-package --skip-git 

echo "Publishing wasm package"
  cd packages/blsdkg && npm run build \
    && echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > pkg/.npmrc 

  cd pkg && npm publish --access=public 
    
