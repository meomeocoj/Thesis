curDir:=$(shell pwd)
baseName := $(notdir $(curDir))_cache
BUILDARCH := $(shell uname -m)

all: schema codegen optimize

optimize-arm64:
	docker run --rm -v "$(curDir)":/code \
  --mount type=volume,source="$(baseName)",target=/code/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  cosmwasm/workspace-optimizer-arm64:0.12.13

optimize-x86_64:
	docker run --rm -v $(curDir):/code \
  --mount type=volume,source=$(baseName),target=/code/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  cosmwasm/workspace-optimizer:0.12.13

optimize: optimize-$(BUILDARCH) 

schema:
	./schema.sh
codegen: ./contract/**/schema
	ts-node codegen/index.ts 
clean:
	rm -rf ./contracts/**/schema target 

.PHONY: optimize schema clean codegen
