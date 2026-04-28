library(RserveTS)
library(jsonlite)

# One environment so all helpers are visible to each other and to ts_compile
this <- environment()
for (f in c(
  "R/vit_data.R",
  "R/vit_gating.R",
  "R/vit_sampvar_bootstrap.R",
  "R/vit_scene.R",
  "R/vit_session.R"
)) {
  sys.source(f, envir = this, keep.source = FALSE)
}
VitSession <- VitSession
