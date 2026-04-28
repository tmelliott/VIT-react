# Statistical core — Phase 1: 1D and simple 2D numeric, mean/median

make_seed <- function(seed) {
  if (missing(seed) || is.null(seed)) {
    as.integer(Sys.time())
  } else {
    as.integer(seed)
  }
}

#' Primary numeric vector for inference (1D) or y in 2D
primary_numeric <- function(s) {
  d <- s$df
  xn <- s$xName
  if (is.null(d) || is.null(xn) || !xn %in% names(d)) {
    return(numeric(0))
  }
  x <- d[[xn]]
  y <- if (nzchar(s$yName) && s$yName %in% names(d)) d[[s$yName]] else NULL
  if (is.null(y)) {
    v <- as.numeric(x)
  } else {
    if (is.numeric(x) && is.numeric(y)) {
      v <- as.numeric(y) # 2D numeric: use y as in scatter
    } else {
      v <- as.numeric(x)
    }
  }
  v[!is.na(v)]
}

#' Categorical "group" for 2nd level (Phase 1 stub: treat as 1D if not two-group)
sampvar_one_resample <- function(s, n, stat, seed) {
  v <- primary_numeric(s)
  if (length(v) < 1L) {
    return(list(index = integer(0L), value = integer(0L), stat = NA_real_))
  }
  set.seed(make_seed(seed))
  nuse <- as.integer(max(1L, min(n, length(v))))
  if (s$module == "sampvar") {
    if (nuse > length(v)) nuse <- length(v)
    ix <- sample.int(length(v), nuse, replace = FALSE)
  } else {
    # bootstrap: resample with replacement (units are population indices)
    ix <- sample.int(length(v), nuse, replace = TRUE)
  }
  svals <- v[ix]
  st <- if (identical(stat, "median")) {
    as.numeric(stats::median(svals))
  } else if (identical(stat, "mean")) {
    as.numeric(mean(svals))
  } else {
    as.numeric(mean(svals)) # default
  }
  list(
    index = as.integer(ix),
    sample = as.numeric(svals),
    stat = st
  )
}

#' Append to history, cap for payload size
accumulate_stat <- function(s, val, max_hist = 5000L) {
  h <- s$history
  if (is.null(h) || !is.numeric(h)) h <- numeric(0L)
  h2 <- c(h, as.numeric(val))
  if (length(h2) > max_hist) {
    h2 <- h2[seq_len(max_hist) + (length(h2) - max_hist)]
  }
  s$history <- h2
  s$iter <- (if (is.null(s$iter)) 0L else s$iter) + 1L
  s
}
