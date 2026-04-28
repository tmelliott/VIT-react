# Column / dataset helpers (Phase 1)

#' @param text Raw CSV (including header)
#' @return list(df = data.frame, error = NULL or string)
read_csv_text <- function(text) {
  if (length(text) == 0L || !nzchar(text)) {
    return(list(df = NULL, error = "empty"))
  }
  tcon <- textConnection(text)
  on.exit(close(tcon), add = TRUE)
  d <- tryCatch(
    read.csv(
      tcon,
      na.strings = c("", "NA", ".", "na"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    error = function(e) NULL
  )
  if (is.null(d) || nrow(d) < 1L) {
    return(list(df = NULL, error = "read_failed"))
  }
  if (nrow(d) == 0L) {
    return(list(df = NULL, error = "no_rows"))
  }
  if (ncol(d) < 1L) {
    return(list(df = NULL, error = "no_columns"))
  }
  list(df = d, error = NULL)
}

infer_col_role <- function(x) {
  if (is.null(x) || (is.numeric(x) && all(is.na(x)))) {
    return("other")
  }
  if (is.numeric(x) || is.integer(x)) {
    return("num")
  }
  if (is.character(x) || is.factor(x) || is.logical(x)) {
    return("cat")
  }
  "other"
}

data_summary_to_json <- function(d) {
  nms <- names(d)
  rows <- vector("list", length(nms))
  for (i in seq_along(nms)) {
    v <- d[[i]]
    rows[[i]] <- list(
      name = nms[[i]],
      role = infer_col_role(v),
      n = nrow(d),
      nValid = length(v[!is.na(v)])
    )
  }
  jsonlite::toJSON(
    list(columns = rows, nRow = nrow(d), nCol = ncol(d)),
    auto_unbox = TRUE
  )
}
