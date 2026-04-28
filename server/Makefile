# From this directory (server):
#   make        — regenerate vit.rserve.R and vit.rserve.ts
#   make copy   — also copy schema to ../src/lib for the Vite app
RSCRIPT = Rscript

default: vit.rserve.R vit.rserve.ts

vit.rserve.R vit.rserve.ts: vit.R
	$(RSCRIPT) -e "RserveTS::ts_compile('vit.R'); RserveTS::ts_deploy('vit.R')"

copy: default
	cp -f vit.rserve.ts ../src/lib/vit.rserve.ts

.PHONY: default copy
