# Gating: which options are available given data + module + current vars

gating_to_list <- function(s) {
  m <- s$module
  if (is.null(m) || !nzchar(m)) m <- "sampvar"
  d <- s$df
  if (is.null(d) || is.null(s$xName) || !nzchar(s$xName)) {
    return(list(
      module = c("sampvar", "bootstrap"),
      canPickY = FALSE,
      canPickGroup = FALSE,
      statChoices = c("mean", "median"),
      sampleSizeMin = 1L,
      sampleSizeMax = 1L,
      canRecord = FALSE
    ))
  }
  if (!s$xName %in% names(d)) {
    return(list(
      module = c("sampvar", "bootstrap"),
      canPickY = FALSE,
      canPickGroup = FALSE,
      statChoices = c("mean", "median"),
      sampleSizeMin = 1L,
      sampleSizeMax = 1L,
      canRecord = FALSE
    ))
  }
  xcol <- d[[s$xName]]
  nx <- length(xcol[!is.na(xcol)])
  nmax <- as.integer(max(1L, nx))
  nmin <- 1L
  has_y <- nzchar(s$yName) && s$yName %in% names(d)
  ycol <- if (has_y) d[[s$yName]] else NULL
  # Phase 1: 1D numeric y/x OR numeric x; two-sample when x cat + y num
  hasSecondNum <- (is.numeric(xcol) && has_y && is.numeric(ycol)) ||
    (is.factor(xcol) | is.character(xcol)) && has_y && (is.numeric(ycol) || is.integer(ycol))
  # Phase 1: 1D mean/median only (proportion/slope in later work)
  stat_choices <- c("mean", "median")
  list(
    module = c("sampvar", "bootstrap"),
    canPickY = ncol(d) > 1L,
    canPickGroup = FALSE,
    statChoices = stat_choices,
    sampleSizeMin = nmin,
    sampleSizeMax = nmax,
    canRecord = nx >= 1L
  )
}

gating_to_json <- function(s) {
  x <- gating_to_list(s)
  # auto_unbox=TRUE so scalars (logical, integer) are JSON booleans/numbers, not
  # single-element arrays — the TS Zod schema expects plain booleans.
  jsonlite::toJSON(x, auto_unbox = TRUE)
}

# Keep s$sampleSize within [sampleSizeMin, sampleSizeMax] for current gating.
# R defaults (e.g. 10) must not exceed population size nmax or resample() errors.
clamp_sample_size <- function(s) {
  g <- gating_to_list(s)
  nmin <- g$sampleSizeMin
  nmax <- g$sampleSizeMax
  n <- s$sampleSize
  if (is.null(n) || length(n) < 1L || is.na(n[1L])) {
    s$sampleSize <- nmin
    return(invisible(NULL))
  }
  n <- as.integer(n[1L])
  if (n < nmin) n <- nmin
  if (n > nmax) n <- nmax
  s$sampleSize <- n
  invisible(NULL)
}
