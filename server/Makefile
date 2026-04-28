OUTDIR = out

vit.rserve.*: vit.R
	mkdir -p $(OUTDIR)
	Rscript -e "RserveTS::ts_compile('vit.R', filename = '$(OUTDIR)/vit.rserve')"

clean:
	rm -rf $(OUTDIR)

.PHONY: clean
