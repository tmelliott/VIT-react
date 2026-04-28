# Build JSON scene list for client (normalized coordinates 0-1 in each band)
`%||%` <- function(x, y) {
  if (is.null(x)) y else x
}

empty_scene <- function() {
  list(
    version = 1L,
    meta = list(
      module = "none",
      stat = "none",
      n = 0L,
      iter = 0L,
      seed = 0L
    ),
    bands = list(
      population = list(
        xlim = c(0, 1),
        points = list()
      ),
      sample = list(
        points = list()
      ),
      statistic = list(
        current = NA,
        history = list()
      )
    ),
    transitionHint = list(
      movedFrom = "none"
    )
  )
}

# Normalize to [0,1]
norm01 <- function(x, r) {
  if (is.null(x) || length(x) < 1L) {
    return(numeric(0L))
  }
  dd <- r[2L] - r[1L]
  if (dd < 1e-12) {
    return(rep(0.5, length(x)))
  }
  (x - r[1L]) / dd
}

xlim_range <- function(x) {
  r <- range(x, na.rm = TRUE)
  if (any(!is.finite(r))) {
    c(0, 1)
  } else {
    p <- 0.04 * diff(r)
    c(r[1L] - p, r[2L] + p)
  }
}

build_points_population <- function(v) {
  if (length(v) < 1L) {
    return(list())
  }
  xr <- xlim_range(v)
  nx <- norm01(v, xr)
  l <- vector("list", length(nx))
  for (i in seq_along(nx)) {
    l[[i]] <- list(
      id = paste0("p", i),
      x = nx[[i]],
      y = 0.5
    )
  }
  l
}

build_points_sample <- function(sv, v_full) {
  if (is.null(sv$sample) || length(sv$sample) < 1L) {
    return(list())
  }
  xr <- xlim_range(v_full)
  nx <- norm01(sv$sample, xr)
  l <- vector("list", length(nx))
  for (i in seq_along(nx)) {
    l[[i]] <- list(
      id = paste0("s", i),
      x = nx[[i]],
      y = 0.5
    )
  }
  l
}

scene_to_json <- function(scene) {
  jsonlite::toJSON(
    scene,
    auto_unbox = TRUE,
    null = "null"
  )
}

build_scene_from_state <- function(s) {
  sc <- empty_scene()
  v <- primary_numeric(s)
  m <- s$module
  if (is.null(m) || !nzchar(m)) m <- "sampvar"
  sc$meta$module <- m
  sc$meta$stat <- s$stat %||% "mean"
  sc$meta$n <- s$sampleSize
  sc$meta$iter <- s$iter %||% 0L
  sc$meta$seed <- s$lastSeed %||% 0L

  xr_full <- xlim_range(v)
  sc$bands$population$valueRange <- list(min = xr_full[[1L]], max = xr_full[[2L]])
  sc$bands$population$points <- build_points_population(v)
  if (!is.null(s$lastResample) && is.list(s$lastResample)) {
    r <- s$lastResample
    sc$bands$sample$points <- build_points_sample(
      r,
      v
    )
    if (is.null(sc$meta$n)) {
      sc$meta$n <- length(r$sample)
    }
  }
  h <- s$history
  # Same horizontal scale as population/sample (values are means/medians in data units)
  if (is.null(h) || !length(h)) {
    sc$bands$statistic$history <- list()
  } else {
    sh <- norm01(h, xr_full)
    nh <- length(sh)
    # Dotplot: same (near-equal) x stacks upward from the bottom of the band
    eps <- 1e-5
    stack_rank <- integer(nh)
    for (i in seq_len(nh)) {
      if (i == 1L) {
        stack_rank[[1L]] <- 0L
      } else {
        prev <- sh[seq_len(i - 1L)]
        si <- sh[[i]]
        stack_rank[[i]] <- as.integer(sum(
          !is.na(prev) & !is.na(si) & abs(prev - si) < eps,
          na.rm = TRUE
        ))
      }
    }
    y_floor <- 0.9
    dy <- 0.032
    y_min <- 0.1
    sc$bands$statistic$history <- lapply(seq_len(nh), function(i) {
      shi <- sh[[i]]
      sr <- stack_rank[[i]]
      yi <- y_floor - sr * dy
      if (yi < y_min) yi <- y_min
      list(
        id = paste0("h", i),
        x = if (is.na(shi)) 0 else shi,
        y = yi
      )
    })
  }
  if (!is.null(s$lastResample) && is.list(s$lastResample) &&
        is.finite(s$lastResample$stat)) {
    sc$bands$statistic$current <- list(
      x = norm01(s$lastResample$stat, xr_full)[[1]],
      value = s$lastResample$stat
    )
  }
  sc$transitionHint$movedFrom <- s$transHint %||% "resample"

  # One-shot animation hints for the React client (cleared after refresh_json)
  if (!is.null(s$anim) && is.list(s$anim)) {
    sc$animation <- s$anim
  } else if (!is.null(s$burstAnim) && is.list(s$burstAnim)) {
    sc$animation <- s$burstAnim
  }

  sc
}
