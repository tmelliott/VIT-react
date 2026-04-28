# VitSession: RserveTS root widget
# --- helper: R env holding session (not in TS) ---
init_state <- function() {
  e <- new.env(parent = emptyenv())
  e$df <- NULL
  e$xName <- ""
  e$yName <- ""
  e$gName <- ""
  e$module <- "sampvar"
  e$stat <- "mean"
  e$sampleSize <- 10L
  e$history <- numeric(0L)
  e$iter <- 0L
  e$lastSeed <- 0L
  e$lastResample <- NULL
  e$transHint <- "init"
  e$paired <- FALSE
  e$resampleWithin <- FALSE
  e
}

state_to_env <- function(w) {
  e <- w$get("vitState")
  if (is.null(e) || !is.environment(e)) {
    w$set("vitState", init_state())
    w$get("vitState")
  } else {
    e
  }
}

refresh_json <- function(w) {
  s <- state_to_env(w)
  w$set("gatingJson", gating_to_json(s))
  sc <- build_scene_from_state(s)
  s$anim <- NULL
  s$burstAnim <- NULL
  w$set("sceneJson", scene_to_json(sc))
  w$set("dataSummaryJson", {
    d <- s$df
    if (is.null(d) || is.null(nrow(d))) {
      jsonlite::toJSON(list(loaded = FALSE), auto_unbox = TRUE)
    } else {
      data_summary_to_json(d)
    }
  })
  w$set("lastError", "")
  invisible(NULL)
}

# Register ref classes in .GlobalEnv so methods::getPackageName() does not invent
# anonymous "package" names, and removeRefClass() can clear repeats when
# ts_compile() sources this file more than once in the same R process.
try(methods::removeRefClass("VitSession", where = .GlobalEnv), silent = TRUE)

VitSession <- createWidget(
  "VitSession",
  properties = list(
    # Internal state not exposed in generated TS
    vitState = "ANY",
    sceneJson = ts_character(1L, default = "{}"),
    gatingJson = ts_character(1L, default = "{}"),
    dataSummaryJson = ts_character(1L, default = "{}"),
    lastError = ts_character(1L, default = "")
  ),
  initialize = function(w) {
    w$set("vitState", init_state())
    w$set("sceneJson", "{}")
    w$set("gatingJson", gating_to_json(state_to_env(w)))
    w$set("dataSummaryJson", jsonlite::toJSON(list(loaded = FALSE), auto_unbox = TRUE))
    w$set("lastError", "")
  },
  methods = list(
    loadCsv = ts_function(
      function(text = ts_character(1L)) {
        w <- .self
        s <- state_to_env(w)
        p <- read_csv_text(text[1L])
        if (!is.null(p$error)) {
          s$df <- NULL
          w$set("lastError", p$error)
          w$set("gatingJson", gating_to_json(s))
          return(invisible(NULL))
        }
        s$df <- p$df
        s$xName <- ""
        s$yName <- ""
        s$history <- numeric(0L)
        s$lastResample <- NULL
        s$iter <- 0L
        clamp_sample_size(s)
        refresh_json(w)
        invisible(NULL)
      },
      result = ts_null()
    ),
    setModule = ts_function(
      function(m = ts_character(1L)) {
        s <- state_to_env(.self)
        mod <- m[1L]
        if (!(mod %in% c("sampvar", "bootstrap"))) {
          .self$set("lastError", "bad_module")
          return(invisible(NULL))
        }
        s$module <- mod
        s$history <- numeric(0L)
        s$lastResample <- NULL
        s$iter <- 0L
        clamp_sample_size(s)
        refresh_json(.self)
        invisible(NULL)
      },
      result = ts_null()
    ),
    setVarRoles = ts_function(
      function(
        x = ts_character(1L),
        y = ts_character(1L, default = ""),
        group = ts_character(1L, default = "")
      ) {
        s <- state_to_env(.self)
        s$xName <- x[1L]
        s$yName <- y[1L]
        s$gName <- group[1L]
        s$history <- numeric(0L)
        s$lastResample <- NULL
        s$iter <- 0L
        clamp_sample_size(s)
        refresh_json(.self)
        invisible(NULL)
      },
      result = ts_null()
    ),
    setStatConfig = ts_function(
      function(
        stat = ts_character(1L, default = "mean"),
        sampleSize = ts_integer(1L, default = 10L)
      ) {
        s <- state_to_env(.self)
        s$stat <- stat[1L]
        s$sampleSize <- as.integer(sampleSize[1L])
        if (s$sampleSize < 1L) s$sampleSize <- 1L
        clamp_sample_size(s)
        refresh_json(.self)
        invisible(NULL)
      },
      result = ts_null()
    ),
    setBootstrapOptions = ts_function(
      function(
        paired = ts_logical(1L, default = FALSE),
        resampleWithin = ts_logical(1L, default = FALSE)
      ) {
        s <- state_to_env(.self)
        s$paired <- isTRUE(paired[1L])
        s$resampleWithin <- isTRUE(resampleWithin[1L])
        refresh_json(.self)
        invisible(NULL)
      },
      result = ts_null()
    ),
    recordAndBuild = ts_function(
      function() {
        w <- .self
        s <- state_to_env(w)
        g <- gating_to_list(s)
        nmax <- g$sampleSizeMax
        s$iter <- 0L
        s$history <- numeric(0L)
        s$lastResample <- NULL
        s$transHint <- "record"
        clamp_sample_size(s)
        refresh_json(w)
        invisible(NULL)
      },
      result = ts_null()
    ),
    resample = ts_function(
      function(seed = ts_integer(1L, default = 0L)) {
        w <- .self
        s <- state_to_env(w)
        sdval <- as.integer(seed[1L])
        g <- gating_to_list(s)
        if (is.null(s$df) || !g$canRecord) {
          w$set("lastError", "cannot_resample")
          return(invisible(NULL))
        }
        clamp_sample_size(s)
        n <- s$sampleSize
        g <- gating_to_list(s)
        nmax <- g$sampleSizeMax
        if (n < g$sampleSizeMin || n > nmax) {
          w$set("lastError", "bad_n")
          return(invisible(NULL))
        }
        if (sdval <= 0L) {
          s$lastSeed <- as.integer(stats::runif(1, 1, 1e7))
        } else {
          s$lastSeed <- sdval
        }
        r <- sampvar_one_resample(s, n, s$stat, s$lastSeed)
        prev_hist_len <- length(s$history)
        v <- primary_numeric(s)
        xr <- xlim_range(v)
        s$anim <- list(
          tier = "single",
          popHighlightIds = as.character(paste0("p", r$index)),
          sampleXs = as.numeric(norm01(r$sample, xr)),
          statValue = r$stat,
          prevHistoryCount = prev_hist_len
        )
        s$lastResample <- r
        s$transHint <- "resample"
        accumulate_stat(s, r$stat, 5000L)
        refresh_json(w)
        invisible(NULL)
      },
      result = ts_null()
    ),
    resampleBatch = ts_function(
      function(
        count = ts_integer(1L),
        seed = ts_integer(1L, default = 0L)
      ) {
        w <- .self
        s <- state_to_env(w)
        g <- gating_to_list(s)
        if (is.null(s$df) || !g$canRecord) {
          w$set("lastError", "cannot_resample")
          return(invisible(NULL))
        }
        clamp_sample_size(s)
        n <- s$sampleSize
        g <- gating_to_list(s)
        nmax <- g$sampleSizeMax
        if (n < g$sampleSizeMin || n > nmax) {
          w$set("lastError", "bad_n")
          return(invisible(NULL))
        }
        cnt <- as.integer(count[1L])
        cnt <- max(1L, min(cnt, 5000L))
        sdval <- as.integer(seed[1L])
        from_len <- length(s$history)
        stats <- numeric(cnt)
        last_r <- NULL
        for (i in seq_len(cnt)) {
          if (sdval <= 0L) {
            s$lastSeed <- as.integer(stats::runif(1, 1, 1e7))
          } else {
            s$lastSeed <- as.integer(sdval + i - 1L)
          }
          last_r <- sampvar_one_resample(s, n, s$stat, s$lastSeed)
          stats[[i]] <- last_r$stat
          accumulate_stat(s, last_r$stat, 5000L)
        }
        s$lastResample <- last_r
        s$transHint <- "burst"
        to_len <- length(s$history)
        s$burstAnim <- list(
          tier = "burst",
          stats = as.numeric(stats),
          fromHistoryCount = from_len,
          toHistoryCount = to_len
        )
        s$anim <- NULL
        refresh_json(w)
        invisible(NULL)
      },
      result = ts_null()
    )
  ),
  auto_flush = TRUE,
  .env = .GlobalEnv,
  export = TRUE
)
