#' Two-categorical proportion sampling variation engine.

source("modules/sampling_one_cat.R")

extract_two_cat_population <- function(widget) {
    d <- parent_data(widget)
    xvar <- widget$xvar
    yvar <- widget$yvar
    if (is.null(d) || !nzchar(xvar) || !nzchar(yvar)) {
        return(NULL)
    }
    if (!xvar %in% names(d) || !yvar %in% names(d)) {
        return(NULL)
    }

    x <- as.character(d[[xvar]])
    y <- as.character(d[[yvar]])
    ok <- !is.na(x) & !is.na(y) & nzchar(x) & nzchar(y)
    if (!any(ok)) {
        return(NULL)
    }

    loi <- if (nzchar(widget$loi)) widget$loi else NULL
    enc <- encode_loi(x[ok], loi)
    list(
        encoded = enc$encoded,
        y = y[ok],
        loi = enc$loi,
        loi_alt = enc$loi_alt,
        x_levels = enc$x_levels,
        category_labels = enc$category_labels
    )
}

group_proportions_for_levels <- function(encoded, y, levels) {
    vapply(levels, function(g) {
        idx <- y == g
        if (!any(idx)) {
            return(NA_real_)
        }
        calc_proportion(encoded[idx])
    }, numeric(1))
}

order_group_levels_by_proportion <- function(encoded, y) {
    raw_levels <- unique(y)
    if (length(raw_levels) < 2L) {
        stop("Grouping variable needs at least 2 categories", call. = FALSE)
    }
    props <- group_proportions_for_levels(encoded, y, raw_levels)
    raw_levels[order(props)]
}

encode_groups <- function(y, levels) {
    match(y, levels) - 1L
}

two_group_prop_diff <- function(gprops) {
    gprops[[2L]] - gprops[[1L]]
}

population_prop_summary <- function(encoded, y, levels, n_groups) {
    if (n_groups == 2L) {
        gprops <- group_proportions_for_levels(encoded, y, levels)
        two_group_prop_diff(gprops)
    } else {
        grand <- calc_proportion(encoded)
        devs <- vapply(levels, function(g) {
            abs(group_proportions_for_levels(encoded, y, g) - grand)
        }, numeric(1))
        mean(devs)
    }
}

sample_prop_replicate_stat <- function(
    encoded,
    y,
    levels,
    n_groups,
    population_grand = NULL) {
    if (n_groups == 2L) {
        gprops <- group_proportions_for_levels(encoded, y, levels)
        two_group_prop_diff(gprops)
    } else {
        ref <- if (!is.null(population_grand)) {
            population_grand
        } else {
            calc_proportion(encoded)
        }
        devs <- vapply(levels, function(g) {
            idx <- y == g
            if (!any(idx)) {
                return(0)
            }
            abs(calc_proportion(encoded[idx]) - ref)
        }, numeric(1))
        mean(devs)
    }
}

sample_has_multiple_groups <- function(y, levels) {
    present <- levels[vapply(levels, function(g) any(y == g), logical(1))]
    length(present) >= 2L
}

compute_two_cat_sampling <- function(
    encoded,
    y,
    sample_size,
    num_reps = NUM_REPS,
    progress_callback = NULL) {
    n_pop <- length(encoded)
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

    levels <- order_group_levels_by_proportion(encoded, y)
    n_groups <- length(levels)
    groups <- encode_groups(y, levels)
    group_stats <- group_proportions_for_levels(encoded, y, levels)
    population_grand <- calc_proportion(encoded)
    population_stat <- population_prop_summary(
        encoded,
        y,
        levels,
        n_groups
    )
    stat_kind <- if (n_groups == 2L) "difference" else "average_deviation"

    pop_domain <- c(0, 1)
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
        se <- encoded[idx]
        sample_stats[[i]] <- sample_prop_replicate_stat(
            se,
            sy,
            levels,
            n_groups,
            population_grand
        )
        if (i <= pool_reps) {
            sample_indices[(idx_offset + 1L):(idx_offset + sample_size)] <- idx - 1L
            idx_offset <- idx_offset + sample_size
        }

        if (!is.null(progress_callback) && (i %% 50L == 0L || i == num_reps)) {
            progress_callback(as.integer(floor(100 * i / num_reps)))
        }
    }

    dist_domain <- proportion_domain(sample_stats[is.finite(sample_stats)])
    if (length(dist_domain) != 2L) {
        dist_domain <- c(0, 1)
    }
    if (n_groups == 2L) {
        pop_span <- 1
        half <- pop_span / 2
        dist_domain <- c(population_stat - half, population_stat + half)
    } else if (n_groups >= 3L) {
        dist_domain <- c(0, 1)
    }

    list(
        population_category = as.integer(encoded),
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

preview_two_cat <- function(widget) {
    dat <- extract_two_cat_population(widget)
    if (is.null(dat)) {
        return(NULL)
    }
    levels <- order_group_levels_by_proportion(dat$encoded, dat$y)
    n_groups <- length(levels)
    group_stats <- group_proportions_for_levels(dat$encoded, dat$y, levels)
    population_stat <- population_prop_summary(
        dat$encoded,
        dat$y,
        levels,
        n_groups
    )
    list(
        population_category = dat$encoded,
        population_group = as.integer(encode_groups(dat$y, levels)),
        group_levels = as.character(levels),
        group_stats = as.numeric(group_stats),
        population_stat = population_stat,
        loi = dat$loi,
        loi_alt = dat$loi_alt,
        x_levels = dat$x_levels,
        category_labels = dat$category_labels,
        n_groups = as.integer(n_groups)
    )
}

reset_two_cat_state <- function(widget) {
    reset_cat_preview_data(widget)
    reset_num_cat_state(widget)
}
