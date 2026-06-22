source("modules/sampling_one_num.R")

samplingVariation <- createWidget(
    "samplingVariation",
    properties = list(
        vit = "ANY",
        variables = ts_character(0L, default = character(0)),
        xvar = ts_character(1L, default = ""),
        yvar = ts_character(1L, default = ""),
        sample_size = ts_integer(1L, default = 20L),
        statistic = ts_character(1L, default = "mean"),
        status = ts_character(1L, default = "idle"),
        progress = ts_integer(1L, default = 0L),
        error_message = ts_character(1L, default = ""),
        population = ts_numeric(0L, default = numeric(0)),
        population_stat = ts_numeric(1L, default = 0),
        sample_stats = ts_numeric(0L, default = numeric(0)),
        sample_indices = ts_integer(0L, default = integer(0)),
        dist_y = ts_numeric(0L, default = numeric(0)),
        scales = ts_list(
            pop = ts_numeric(0L, default = numeric(0)),
            sample = ts_numeric(0L, default = numeric(0)),
            dist = ts_numeric(0L, default = numeric(0)),
            default = list(
                pop = numeric(0),
                sample = numeric(0),
                dist = numeric(0)
            )
        )
    ),
    initialize = function(widget, parent = NULL) {
        if (!is.null(parent)) {
            widget$vit <- parent
        }
        NULL
    },
    methods = list(
        update_preview = observer(c("xvar", "sample_size", "statistic"), function() {
            if (.self$status == "computing") {
                return()
            }
            if (.self$status == "ready") {
                reset_result_state(.self)
                .self$status <- "idle"
            }
            pop <- extract_population(.self)
            if (is.null(pop)) {
                reset_result_state(.self)
                .self$status <- "idle"
                .self$updateState()
                return()
            }
            .self$batch(c("population", "status", "error_message"), {
                .self$population <- pop
                .self$status <- "idle"
                .self$error_message <- ""
            })
        }),
        record_choices = ts_function(
            function() {
                pop <- extract_population(.self)
                if (is.null(pop)) {
                    .self$status <- "error"
                    .self$error_message <- "Select a numeric variable with loaded data"
                    .self$updateState()
                    return(NULL)
                }

                stat <- .self$statistic
                if (!stat %in% c("mean", "median")) {
                    .self$status <- "error"
                    .self$error_message <- "Statistic must be mean or median"
                    .self$updateState()
                    return(NULL)
                }

                n_pop <- length(pop)
                n_samp <- as.integer(.self$sample_size)
                if (n_samp < 1L || n_samp > n_pop) {
                    .self$status <- "error"
                    .self$error_message <- sprintf(
                        "Sample size must be between 1 and %d",
                        n_pop
                    )
                    .self$updateState()
                    return(NULL)
                }

                .self$status <- "computing"
                .self$progress <- 0L
                .self$error_message <- ""
                .self$updateState()

                result <- tryCatch(
                    compute_one_num_sampling(
                        population = pop,
                        sample_size = n_samp,
                        statistic = stat,
                        progress_callback = function(p) {
                            .self$batch(c("progress", "status"), {
                                .self$progress <- as.integer(p)
                                .self$status <- "computing"
                            })
                        }
                    ),
                    error = function(e) {
                        .self$status <- "error"
                        .self$error_message <- conditionMessage(e)
                        .self$updateState()
                        NULL
                    }
                )

                if (is.null(result)) {
                    return(NULL)
                }

                .self$batch(c(
                    "population",
                    "population_stat",
                    "sample_stats",
                    "sample_indices",
                    "dist_y",
                    "scales",
                    "progress",
                    "status",
                    "error_message"
                ), {
                    .self$population <- result$population
                    .self$population_stat <- result$population_stat
                    .self$sample_stats <- result$sample_stats
                    .self$sample_indices <- result$sample_indices
                    .self$dist_y <- result$dist_y
                    .self$scales <- result$scales
                    .self$progress <- 100L
                    .self$status <- "ready"
                    .self$error_message <- ""
                })

                NULL
            },
            result = ts_null()
        )
    ),
    export = TRUE
)
