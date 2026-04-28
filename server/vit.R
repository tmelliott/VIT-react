library(RserveTS)

## Session-local state for the VIT widget skeleton
.vit <- new.env(parent = emptyenv())

#' Load a tabular dataset from a URL (or path) via iNZightTools::smart_read().
#' Stores the data frame in session state and returns column names.
load_dataset <- ts_function(
  function(url = ts_character(1)) {
    if (!requireNamespace("iNZightTools", quietly = TRUE)) {
      stop("Package 'iNZightTools' is required for smart_read()", call. = FALSE)
    }
    u <- as.character(url)
    d <- iNZightTools::smart_read(u)
    if (!is.data.frame(d)) {
      stop("smart_read() did not return a data.frame", call. = FALSE)
    }
    .vit$data <- d
    colnames(d)
  },
  result = ts_character(0L),
  export = TRUE
)

#' Placeholder list of VIT modules available for this dataset/session.
list_modules <- ts_function(
  function() {
    c(
      "bootstrap",
      "randomisation_stest",
      "reorderable_grid"
    )
  },
  result = ts_character(0L),
  export = TRUE
)
