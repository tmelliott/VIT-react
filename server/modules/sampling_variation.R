source("modules/sampling_one_num.R")
source("modules/sampling_num_cat.R")
source("modules/sampling_one_cat.R")
source("modules/sampling_two_cat.R")
source("modules/sampling_num_num.R")

variable_layout <- function(xvar, yvar, variables, group_variables) {
    if (!nzchar(xvar)) {
        return("empty")
    }
    x_is_num <- xvar %in% variables
    x_is_cat <- xvar %in% group_variables
    y_is_cat <- nzchar(yvar) && yvar %in% group_variables
    y_is_num <- nzchar(yvar) && yvar %in% variables

    if (x_is_num && !y_is_cat) {
        if (!nzchar(yvar)) return("one_num")
        if (y_is_num && yvar != xvar) return("num_num")
        return("unsupported")
    }
    if (x_is_num && y_is_cat) {
        return("num_cat")
    }
    if (x_is_cat && !y_is_cat) {
        return("one_cat")
    }
    if (x_is_cat && y_is_cat && yvar != xvar) {
        return("two_cat")
    }
    "unsupported"
}

reset_result_state <- function(widget) {
    widget$population <- numeric(0)
    widget$population_y <- numeric(0)
    widget$population_intercept <- 0
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
    reset_two_cat_state(widget)
}

update_sampling_preview <- function(widget) {
    if (isTRUE(widget[[".__skip_preview__"]])) {
        return(invisible(NULL))
    }
    if (widget$status == "computing") {
        return(invisible(NULL))
    }
    if (widget$status == "ready") {
        reset_result_state(widget)
        widget$status <- "idle"
    }

    if (!nzchar(widget$xvar)) {
        reset_result_state(widget)
        widget$status <- "idle"
        widget$updateState()
        return(invisible(NULL))
    }

    layout <- variable_layout(
        widget$xvar,
        widget$yvar,
        widget$variables,
        widget$group_variables
    )

    if (layout == "unsupported" || layout == "empty") {
        reset_result_state(widget)
        widget$status <- "idle"
        widget$updateState()
        return(invisible(NULL))
    }

    if (layout == "two_cat") {
        preview <- preview_two_cat(widget)
        if (is.null(preview)) {
            reset_result_state(widget)
            widget$status <- "idle"
            widget$updateState()
            return(invisible(NULL))
        }
        pop_domain <- c(0, 1)
        widget$batch(c(
            "population",
            "population_category",
            "population_group",
            "group_levels",
            "group_stats",
            "n_groups",
            "loi_alt",
            "x_levels",
            "category_labels",
            "stat_kind",
            "population_stat",
            "scales",
            "status",
            "error_message"
        ), {
            widget$population <- numeric(0)
            widget$population_category <- preview$population_category
            widget$population_group <- preview$population_group
            widget$group_levels <- preview$group_levels
            widget$n_groups <- preview$n_groups
            widget$loi_alt <- preview$loi_alt
            widget$x_levels <- preview$x_levels
            widget$category_labels <- preview$category_labels
            widget$stat_kind <- if (preview$n_groups == 2L) {
                "difference"
            } else {
                "average_deviation"
            }
            widget$group_stats <- preview$group_stats
            widget$population_stat <- preview$population_stat
            widget$scales <- list(
                pop = pop_domain,
                sample = pop_domain,
                dist = numeric(0)
            )
            widget$status <- "idle"
            widget$error_message <- ""
        })
        widget$updateState()
        return(invisible(NULL))
    }

    if (layout == "one_cat") {
        preview <- preview_one_cat(widget)
        if (is.null(preview)) {
            reset_result_state(widget)
            widget$status <- "idle"
            widget$updateState()
            return(invisible(NULL))
        }
        pop_domain <- c(0, 1)
        widget$batch(c(
            "population",
            "population_category",
            "group_levels",
            "n_groups",
            "loi_alt",
            "x_levels",
            "category_labels",
            "stat_kind",
            "population_stat",
            "scales",
            "status",
            "error_message"
        ), {
            widget$population <- numeric(0)
            widget$population_category <- preview$population_category
            widget$population_group <- integer(0)
            widget$group_levels <- preview$category_labels
            widget$n_groups <- preview$n_groups
            widget$loi_alt <- preview$loi_alt
            widget$x_levels <- preview$x_levels
            widget$category_labels <- preview$category_labels
            widget$stat_kind <- "proportion"
            widget$population_stat <- preview$population_stat
            widget$group_stats <- numeric(0)
            widget$scales <- list(
                pop = pop_domain,
                sample = pop_domain,
                dist = numeric(0)
            )
            widget$status <- "idle"
            widget$error_message <- ""
        })
        widget$updateState()
        return(invisible(NULL))
    }

    if (layout == "num_cat") {
        preview <- preview_num_cat(widget)
        if (is.null(preview)) {
            reset_result_state(widget)
            widget$status <- "idle"
            widget$updateState()
            return(invisible(NULL))
        }
        pop_domain <- scale_domain(preview$population)
        widget$batch(c(
            "population",
            "population_y",
            "population_group",
            "group_levels",
            "n_groups",
            "stat_kind",
            "population_stat",
            "population_intercept",
            "scales",
            "status",
            "error_message"
        ), {
            widget$population <- preview$population
            widget$population_y <- numeric(0)
            widget$population_intercept <- 0
            widget$population_category <- integer(0)
            widget$population_group <- preview$population_group
            widget$group_levels <- preview$group_levels
            widget$n_groups <- preview$n_groups
            widget$stat_kind <- if (preview$n_groups == 2L) {
                if (widget$statistic == "iqr") "ratio" else "difference"
            } else {
                "average_deviation"
            }
            widget$population_stat <- 0
            widget$scales <- list(
                pop = pop_domain,
                sample = pop_domain,
                dist = numeric(0)
            )
            widget$status <- "idle"
            widget$error_message <- ""
        })
        widget$updateState()
        return(invisible(NULL))
    }

    if (layout == "num_num") {
        preview <- preview_num_num(widget)
        if (is.null(preview)) {
            reset_result_state(widget)
            widget$status <- "idle"
            widget$updateState()
            return(invisible(NULL))
        }
        pop_domain <- scale_domain(preview$population)
        widget$batch(c(
            "population",
            "population_y",
            "population_intercept",
            "population_stat",
            "stat_kind",
            "scales",
            "status",
            "error_message"
        ), {
            widget$population <- preview$population
            widget$population_y <- preview$population_y
            widget$population_intercept <- preview$intercept
            widget$population_stat <- preview$slope
            widget$stat_kind <- "slope"
            widget$population_category <- integer(0)
            widget$population_group <- integer(0)
            widget$group_levels <- character(0)
            widget$group_stats <- numeric(0)
            widget$n_groups <- 0L
            widget$scales <- list(
                pop = pop_domain,
                sample = pop_domain,
                dist = numeric(0)
            )
            widget$status <- "idle"
            widget$error_message <- ""
        })
        widget$updateState()
        return(invisible(NULL))
    }

    pop <- extract_population(widget)
    if (is.null(pop)) {
        reset_result_state(widget)
        widget$status <- "idle"
        widget$updateState()
        return(invisible(NULL))
    }
    pop_domain <- scale_domain(pop)
    widget$batch(c(
        "population",
        "population_y",
        "population_intercept",
        "population_stat",
        "scales",
        "status",
        "error_message"
    ), {
        widget$population <- pop
        widget$population_y <- numeric(0)
        widget$population_intercept <- 0
        widget$population_stat <- 0
        widget$scales <- list(
            pop = pop_domain,
            sample = pop_domain,
            dist = numeric(0)
        )
        reset_num_cat_state(widget)
        reset_cat_preview_data(widget)
        widget$status <- "idle"
        widget$error_message <- ""
    })
    widget$updateState()
    invisible(NULL)
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
        loi = ts_character(1L, default = ""),
        sample_size = ts_integer(1L, default = 20L),
        statistic = ts_character(1L, default = "mean"),
        status = ts_character(1L, default = "idle"),
        progress = ts_integer(1L, default = 0L),
        error_message = ts_character(1L, default = ""),
        population = ts_numeric(0L, default = numeric(0)),
        population_y = ts_numeric(0L, default = numeric(0)),
        population_intercept = ts_numeric(1L, default = 0),
        population_category = ts_integer(0L, default = integer(0)),
        population_group = ts_integer(0L, default = integer(0)),
        group_levels = ts_character(0L, default = character(0)),
        group_stats = ts_numeric(0L, default = numeric(0)),
        x_levels = ts_character(0L, default = character(0)),
        category_labels = ts_character(0L, default = character(0)),
        loi_alt = ts_character(1L, default = ""),
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
            update_sampling_preview(.self)
        }),
        refresh_preview = ts_function(
            function(loi = ts_character(1, default = "")) {
                loi_val <- as.character(loi)
                if (length(loi_val) >= 1L && nzchar(loi_val)) {
                    .self$loi <- loi_val
                }
                update_sampling_preview(.self)
                NULL
            },
            result = ts_null()
        ),
        record_choices = ts_function(
            function() {
                layout <- variable_layout(
                    .self$xvar,
                    .self$yvar,
                    .self$variables,
                    .self$group_variables
                )

                if (layout == "num_num") {
                    dat <- extract_num_num_population(.self)
                    if (is.null(dat)) {
                        .self$status <- "error"
                        .self$error_message <- "Select two numeric variables with loaded data"
                        .self$updateState()
                        return(NULL)
                    }

                    n_pop <- length(dat$population)
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
                        compute_num_num_sampling(
                            x = dat$population,
                            y = dat$population_y,
                            sample_size = n_samp,
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

                    if (is.null(result)) {
                        return(NULL)
                    }

                    reset_num_cat_state(.self)
                    reset_cat_preview_data(.self)
                    .self$population <- result$population
                    .self$population_y <- result$population_y
                    .self$population_intercept <- result$population_intercept
                    .self$population_stat <- result$population_stat
                    .self$stat_kind <- result$stat_kind
                    .self$sample_stats <- result$sample_stats
                    .self$sample_indices <- result$sample_indices
                    .self$dist_y <- result$dist_y
                    .self$scales <- result$scales
                    .self$progress <- 100L
                    .self$status <- "ready"
                    .self$error_message <- ""
                    .self$updateState()
                    return(NULL)
                }

                if (layout == "two_cat") {
                    dat <- extract_two_cat_population(.self)
                    if (is.null(dat)) {
                        .self$status <- "error"
                        .self$error_message <- "Select two categorical variables with loaded data"
                        .self$updateState()
                        return(NULL)
                    }

                    n_pop <- length(dat$encoded)
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
                        compute_two_cat_sampling(
                            encoded = dat$encoded,
                            y = dat$y,
                            sample_size = n_samp,
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

                    if (is.null(result)) {
                        return(NULL)
                    }

                    .self$population <- numeric(0)
                    .self$population_category <- result$population_category
                    .self$population_group <- result$population_group
                    .self$group_levels <- result$group_levels
                    .self$group_stats <- result$group_stats
                    .self$loi_alt <- dat$loi_alt
                    .self$x_levels <- dat$x_levels
                    .self$category_labels <- dat$category_labels
                    .self$stat_kind <- result$stat_kind
                    .self$n_groups <- result$n_groups
                    .self$population_stat <- result$population_stat
                    .self$sample_stats <- result$sample_stats
                    .self$sample_indices <- result$sample_indices
                    .self$dist_y <- result$dist_y
                    .self$scales <- result$scales
                    .self$progress <- 100L
                    .self$status <- "ready"
                    .self$error_message <- ""
                    .self$updateState()
                    return(NULL)
                }

                if (layout == "one_cat") {
                    dat <- extract_one_cat_population(.self)
                    if (is.null(dat)) {
                        .self$status <- "error"
                        .self$error_message <- "Select a categorical variable with loaded data"
                        .self$updateState()
                        return(NULL)
                    }

                    n_pop <- length(dat$encoded)
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
                        compute_one_cat_sampling(
                            encoded = dat$encoded,
                            sample_size = n_samp,
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

                    if (is.null(result)) {
                        return(NULL)
                    }

                    .self$population <- numeric(0)
                    .self$population_category <- result$population_category
                    .self$population_group <- integer(0)
                    .self$group_levels <- dat$category_labels
                    .self$group_stats <- numeric(0)
                    .self$loi_alt <- dat$loi_alt
                    .self$x_levels <- dat$x_levels
                    .self$category_labels <- dat$category_labels
                    .self$stat_kind <- result$stat_kind
                    .self$n_groups <- result$n_groups
                    .self$population_stat <- result$population_stat
                    .self$sample_stats <- result$sample_stats
                    .self$sample_indices <- result$sample_indices
                    .self$dist_y <- result$dist_y
                    .self$scales <- result$scales
                    .self$progress <- 100L
                    .self$status <- "ready"
                    .self$error_message <- ""
                    .self$updateState()
                    return(NULL)
                }

                stat <- .self$statistic
                if (!stat %in% c("mean", "median", "lq", "uq", "iqr")) {
                    .self$status <- "error"
                    .self$error_message <- "Statistic must be mean, median, LQ, UQ, or IQR"
                    .self$updateState()
                    return(NULL)
                }

                if (layout == "num_cat") {
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
                } else if (layout == "one_num") {
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
                } else {
                    .self$status <- "error"
                    .self$error_message <- "Unsupported variable layout"
                    .self$updateState()
                    return(NULL)
                }

                if (is.null(result)) {
                    return(NULL)
                }

                if (layout == "num_cat") {
                    .self$population <- result$population
                    .self$population_group <- result$population_group
                    .self$group_levels <- result$group_levels
                    .self$group_stats <- result$group_stats
                    .self$stat_kind <- result$stat_kind
                    .self$n_groups <- result$n_groups
                    # Clear categorical-only fields; do NOT reset_num_cat_state
                    # (that would wipe the group fields we just set).
                    reset_cat_preview_data(.self)
                } else {
                    reset_num_cat_state(.self)
                    reset_two_cat_state(.self)
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
