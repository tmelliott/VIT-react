#' Numeric × categorical sampling variation engine.

categorical_column_names <- function(d) {
    if (is.null(d) || !is.data.frame(d)) {
        return(character(0))
    }
    names(d)[vapply(d, function(col) {
        is.factor(col) || is.character(col) || is.logical(col)
    }, logical(1))]
}

extract_num_cat_population <- function(widget) {
    d <- parent_data(widget)
    xvar <- widget$xvar
    yvar <- widget$yvar
    if (is.null(d) || !nzchar(xvar) || !nzchar(yvar)) {
        return(NULL)
    }
    if (!xvar %in% names(d) || !yvar %in% names(d)) {
        return(NULL)
    }

    x <- as.numeric(d[[xvar]])
    y <- as.character(d[[yvar]])
    ok <- !is.na(x) & !is.na(y) & nzchar(y)
    if (!any(ok)) {
        return(NULL)
    }

    list(
        x = x[ok],
        y = y[ok]
    )
}

group_stats_for_levels <- function(x, y, levels, statistic) {
    vapply(levels, function(g) {
        sample_statistic(x[y == g], statistic)
    }, numeric(1))
}

order_group_levels <- function(x, y, statistic) {
    raw_levels <- unique(y)
    if (length(raw_levels) < 2L) {
        stop("Grouping variable needs at least 2 categories", call. = FALSE)
    }
    stats <- group_stats_for_levels(x, y, raw_levels, statistic)
    raw_levels[order(stats)]
}

encode_groups <- function(y, levels) {
    match(y, levels) - 1L
}

two_group_summary_stat <- function(gstats, statistic) {
    if (statistic == "iqr") {
        if (gstats[[1L]] == 0) {
            return(NA_real_)
        }
        gstats[[2L]] / gstats[[1L]]
    } else {
        gstats[[2L]] - gstats[[1L]]
    }
}

population_summary_stat <- function(x, y, levels, statistic, n_groups) {
    if (n_groups == 2L) {
        gstats <- group_stats_for_levels(x, y, levels, statistic)
        two_group_summary_stat(gstats, statistic)
    } else {
        gstat <- sample_statistic(x, statistic)
        devs <- vapply(levels, function(g) {
            abs(sample_statistic(x[y == g], statistic) - gstat)
        }, numeric(1))
        mean(devs)
    }
}

sample_replicate_stat <- function(
    x,
    y,
    levels,
    statistic,
    n_groups,
    population_grand = NULL) {
    if (n_groups == 2L) {
        gstats <- group_stats_for_levels(x, y, levels, statistic)
        two_group_summary_stat(gstats, statistic)
    } else {
        ref_stat <- if (!is.null(population_grand)) {
            population_grand
        } else {
            sample_statistic(x, statistic)
        }
        present <- levels[vapply(levels, function(g) any(y == g), logical(1))]
        if (length(present) == 0L) {
            return(NA_real_)
        }
        devs <- vapply(present, function(g) {
            abs(sample_statistic(x[y == g], statistic) - ref_stat)
        }, numeric(1))
        mean(devs)
    }
}

sample_has_multiple_groups <- function(y, levels) {
    present <- levels[vapply(levels, function(g) any(y == g), logical(1))]
    length(present) >= 2L
}

compute_num_cat_sampling <- function(
    x,
    y,
    sample_size,
    statistic = c("mean", "median", "lq", "uq", "iqr"),
    num_reps = NUM_REPS,
    progress_callback = NULL) {
    statistic <- match.arg(statistic)
    n_pop <- length(x)
    if (n_pop == 0L) {
        stop("Population is empty", call. = FALSE)
    }

    sample_size <- as.integer(sample_size)
    if (sample_size < 2L || sample_size > n_pop) {
        stop(
            "Sample size must be between 2 and ",
            n_pop,
            call. = FALSE
        )
    }

    levels <- order_group_levels(x, y, statistic)
    n_groups <- length(levels)
    groups <- encode_groups(y, levels)
    group_stats <- group_stats_for_levels(x, y, levels, statistic)
    population_stat <- population_summary_stat(
        x,
        y,
        levels,
        statistic,
        n_groups
    )
    if (n_groups >= 3L && statistic %in% c("lq", "uq", "iqr")) {
        stop(
            "Quartile statistics are only supported for one numeric or two-group layouts",
            call. = FALSE
        )
    }
    stat_kind <- if (n_groups == 2L) {
        if (statistic == "iqr") "ratio" else "difference"
    } else {
        "average_deviation"
    }

    pop_domain <- scale_domain(x)
    sample_stats <- numeric(num_reps)
    pool_reps <- min(num_reps, ANIM_POOL_SIZE)
    sample_indices <- integer(pool_reps * sample_size)
    idx_offset <- 0L

    for (i in seq_len(num_reps)) {
        repeat {
            idx <- sample.int(n_pop, sample_size, replace = FALSE)
            sy <- y[idx]
            ok <- sample_has_multiple_groups(sy, levels)
            if (ok) {
                break
            }
        }
        sx <- x[idx]
        sample_stats[[i]] <- sample_replicate_stat(
            sx,
            sy,
            levels,
            statistic,
            n_groups
        )
        if (i <= pool_reps) {
            sample_indices[(idx_offset + 1L):(idx_offset + sample_size)] <- idx - 1L
            idx_offset <- idx_offset + sample_size
        }

        if (!is.null(progress_callback) && (i %% 50L == 0L || i == num_reps)) {
            progress_callback(as.integer(floor(100 * i / num_reps)))
        }
    }

    dist_domain <- scale_domain(sample_stats[is.finite(sample_stats)])
    if (length(dist_domain) != 2L) {
        dist_domain <- c(0, 1)
    }
    if (n_groups == 2L) {
        pop_span <- diff(pop_domain)
        if (!is.finite(pop_span) || pop_span <= 0) {
            pop_span <- max(abs(dist_domain))
        }
        half <- pop_span / 2
        dist_domain <- c(population_stat - half, population_stat + half)
    } else if (n_groups >= 3L) {
        pop_span <- diff(pop_domain)
        if (!is.finite(pop_span) || pop_span <= 0) {
            pop_span <- max(dist_domain[2L], 1)
        }
        dist_domain <- c(0, pop_span)
    }

    list(
        population = as.numeric(x),
        population_group = as.integer(groups),
        group_levels = as.character(levels),
        group_stats = as.numeric(group_stats),
        population_stat = population_stat,
        stat_kind = stat_kind,
        n_groups = as.integer(n_groups),
        sample_stats = sample_stats,
        sample_indices = sample_indices,
        scales = list(
            pop = pop_domain,
            sample = pop_domain,
            dist = dist_domain
        ),
        dist_y = numeric(0),
        sample_size = sample_size
    )
}

reset_num_cat_state <- function(widget) {
    widget$population_group <- integer(0)
    widget$group_levels <- character(0)
    widget$group_stats <- numeric(0)
    widget$stat_kind <- ""
    widget$n_groups <- 0L
}

preview_num_cat <- function(widget) {
    dat <- extract_num_cat_population(widget)
    if (is.null(dat)) {
        return(NULL)
    }
    stat <- widget$statistic
    if (!stat %in% c("mean", "median", "lq", "uq", "iqr")) {
        stat <- "mean"
    }
    levels <- order_group_levels(dat$x, dat$y, stat)
    list(
        population = as.numeric(dat$x),
        population_group = as.integer(encode_groups(dat$y, levels)),
        group_levels = as.character(levels),
        n_groups = as.integer(length(levels))
    )
}
