# Run from server directory: Rscript tests/test-scene.R
if (!requireNamespace("testthat", quietly = TRUE)) {
  message("SKIP: install testthat to run")
  quit(status = 0)
}

library(RserveTS, quietly = TRUE)
env <- new.env()
for (f in c(
  "R/vit_data.R",
  "R/vit_gating.R",
  "R/vit_sampvar_bootstrap.R",
  "R/vit_scene.R",
  "R/vit_session.R"
)) {
  sys.source(f, envir = env, keep.source = FALSE)
}
library(jsonlite, quietly = TRUE)

init_state <- env$init_state
sampvar_one_resample <- env$sampvar_one_resample
build_scene_from_state <- env$build_scene_from_state
scene_to_json <- env$scene_to_json
gating_to_json <- env$gating_to_json

testthat::test_that("one resample has finite stat for numeric csv", {
  s <- init_state()
  s$df <- read.csv(text = "x\n1\n2\n3\n4\n5")
  s$xName <- "x"
  s$module <- "sampvar"
  s$stat <- "mean"
  s$sampleSize <- 3L
  s$lastResample <- sampvar_one_resample(s, 3L, "mean", 1L)
  s$transHint <- "resample"
  testthat::expect_true(is.finite(s$lastResample$stat))
  js <- scene_to_json(build_scene_from_state(s))
  p <- jsonlite::fromJSON(js, simplifyVector = FALSE)
  testthat::expect_equal(p$version, 1L)
  testthat::expect_length(p$bands$population$points, 5L)
})

testthat::test_that("gating canRecord when x is set", {
  s <- init_state()
  s$df <- data.frame(x = 1:5, y = 1:5)
  s$xName <- "x"
  s$yName <- ""
  g <- jsonlite::fromJSON(gating_to_json(s), simplifyVector = TRUE)
  testthat::expect_true(isTRUE(g$canRecord))
})
