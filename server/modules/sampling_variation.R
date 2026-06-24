source("modules/sampling_one_num.R")
source("modules/sampling_num_cat.R")

reset_result_state <- function(widget) {
    widget$population <- numeric(0)
    widget$population_stat <- 0
    widget$sample_stats <- numeric(0)
    widget$sample_indices <- integer(0)
    widget$dist_y <- numeric(0)
    widget$scales <- list(
        pop = numeric(0),
        sample = numeric(0),
        dist = numeric(0)
    )
    widget$error_message <- ""
    reset_num_cat_state(widget)
}

samplingVariation <- createWidget(
    "samplingVariation",
    properties = list(
        vit = "ANY",
        variables = ts_character(0L, default = character(0)),
        group_variables = ts_character(0L, default = character(0)),
        all_variables = ts_character(0L, default = character(0)),
        xvar = ts_character(1L, default = ""),
        yvar = ts_character(1L, default = ""),
        sample_size = ts_integer(1L, default = 20L),
        statistic = ts_character(1L, default = "mean"),
        status = ts_character(1L, default = "idle"),
        progress = ts_integer(1L, default = 0L),
        error_message = ts_character(1L, default = ""),
        population = ts_numeric(0L, default = numeric(0)),
        population_group = ts_integer(0L, default = integer(0)),
        group_levels = ts_character(0L, default = character(0)),
        group_stats = ts_numeric(0L, default = numeric(0)),
        stat_kind = ts_character(1L, default = ""),
        n_groups = ts_integer(1L, default = 0L),
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
        update_preview = observer(c("xvar", "yvar", "sample_size", "statistic"), function() {
            if (.self$status == "computing") {
                return()
            }
            if (.self$status == "ready") {
                reset_result_state(.self)
                .self$status <- "idle"
            }

            if (!nzchar(.self$xvar)) {
                reset_result_state(.self)
                .self$status <- "idle"
                .self$updateState()
                return()
            }

            if (!(.self$xvar %in% .self$variables)) {
                reset_result_state(.self)
                .self$status <- "idle"
                .self$updateState()
                return()
            }

            if (nzchar(.self$yvar) && !(.self$yvar %in% .self$group_variables)) {
                reset_result_state(.self)
                .self$status <- "idle"
                .self$updateState()
                return()
            }

            if (nzchar(.self$yvar)) {
                preview <- preview_num_cat(.self)
                if (is.null(preview)) {
                    reset_result_state(.self)
                    .self$status <- "idle"
                    .self$updateState()
                    return()
                }
                pop_domain <- scale_domain(preview$population)
                .self$batch(c(
                    "population",
                    "population_group",
                    "group_levels",
                    "n_groups",
                    "stat_kind",
                    "population_stat",
                    "scales",
                    "status",
                    "error_message"
                ), {
                    .self$population <- preview$population
                    .self$population_group <- preview$population_group
                    .self$group_levels <- preview$group_levels
                    .self$n_groups <- preview$n_groups
                    .self$stat_kind <- if (preview$n_groups == 2L) {
                        "difference"
                    } else {
                        "average_deviation"
                    }
                    .self$population_stat <- 0
                    .self$scales <- list(
                        pop = pop_domain,
                        sample = pop_domain,
                        dist = numeric(0)
                    )
                    .self$status <- "idle"
                    .self$error_message <- ""
                })
                .self$updateState()
                return()
            }

            pop <- extract_population(.self)
            if (is.null(pop)) {
                reset_result_state(.self)
                .self$status <- "idle"
                .self$updateState()
                return()
            }
            pop_domain <- scale_domain(pop)
            .self$batch(c(
                "population",
                "population_stat",
                "scales",
                "status",
                "error_message"
            ), {
                .self$population <- pop
                .self$population_stat <- 0
                .self$scales <- list(
                    pop = pop_domain,
                    sample = pop_domain,
                    dist = numeric(0)
                )
                reset_num_cat_state(.self)
                .self$status <- "idle"
                .self$error_message <- ""
            })
            .self$updateState()
        }),
        record_choices = ts_function(
            function() {
                stat <- .self$statistic
                if (!stat %in% c("mean", "median")) {
                    .self$status <- "error"
                    .self$error_message <- "Statistic must be mean or median"
                    .self$updateState()
                    return(NULL)
                }

                if (nzchar(.self$yvar)) {
                    dat <- extract_num_cat_population(.self)
                    if (is.null(dat)) {
                        .self$status <- "error"
                        .self$error_message <- "Select numeric and grouping variables with loaded data"
                        .self$updateState()
                        return(NULL)
                    }

                    n_pop <- length(dat$x)
                    n_samp <- as.integer(.self$sample_size)
                    if (n_samp < 2L || n_samp > n_pop) {
                        .self$status <- "error"
                        .self$error_message <- sprintf(
                            "Sample size must be between 2 and %d",
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
                        compute_num_cat_sampling(
                            x = dat$x,
                            y = dat$y,
                            sample_size = n_samp,
                            statistic = stat,
                            progress_callback = function(p) {
                                .self$progress <- as.integer(p)
                                .self$updateState()
                            }
                        ),
                        error = function(e) {
                            .self$status <- "error"
                            .self$error_message <- conditionMessage(e)
                            .self$updateState()
                            NULL
                        }
                    )
                } else {
                    pop <- extract_population(.self)
                    if (is.null(pop)) {
                        .self$status <- "error"
                        .self$error_message <- "Select a numeric variable with loaded data"
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
                                .self$progress <- as.integer(p)
                                .self$updateState()
                            }
                        ),
                        error = function(e) {
                            .self$status <- "error"
                            .self$error_message <- conditionMessage(e)
                            .self$updateState()
                            NULL
                        }
                    )
                }

                if (is.null(result)) {
                    return(NULL)
                }

                if (nzchar(.self$yvar)) {
                    .self$population <- result$population
                    .self$population_group <- result$population_group
                    .self$group_levels <- result$group_levels
                    .self$group_stats <- result$group_stats
                    .self$stat_kind <- result$stat_kind
                    .self$n_groups <- result$n_groups
                } else {
                    reset_num_cat_state(.self)
                    .self$population <- result$population
                }

                .self$population_stat <- result$population_stat
                .self$sample_stats <- result$sample_stats
                .self$sample_indices <- result$sample_indices
                .self$dist_y <- result$dist_y
                .self$scales <- result$scales
                .self$progress <- 100L
                .self$status <- "ready"
                .self$error_message <- ""
                .self$updateState()

                NULL
            },
            result = ts_null()
        )
    ),
    export = TRUE
)
