#' Numeric × numeric (regression slope) sampling variation engine.

NUM_REPS <- 1000L
ANIM_POOL_SIZE <- 100L

least_squares <- function(x, y) {
    ok <- is.finite(x) & is.finite(y)
    x <- x[ok]
    y <- y[ok]
    n <- length(x)
    if (n < 2L) {
        return(NULL)
    }
    sum_x <- sum(x)
    sum_y <- sum(y)
    sum_xy <- sum(x * y)
    sum_xx <- sum(x * x)
    denom <- n * sum_xx - sum_x * sum_x
    if (!is.finite(denom) || abs(denom) < .Machine$double.eps) {
        return(NULL)
    }
    slope <- (n * sum_xy - sum_x * sum_y) / denom
    intercept <- (sum_y - slope * sum_x) / n
    list(slope = as.numeric(slope), intercept = as.numeric(intercept), n = n)
}

extract_num_num_population <- function(widget) {
    d <- parent_data(widget)
    xvar <- widget$xvar
    yvar <- widget$yvar
    if (
        is.null(d) ||
            !nzchar(xvar) ||
            !nzchar(yvar) ||
            !xvar %in% names(d) ||
            !yvar %in% names(d)
    ) {
        return(NULL)
    }
    x <- as.numeric(d[[xvar]])
    y <- as.numeric(d[[yvar]])
    ok <- is.finite(x) & is.finite(y)
    x <- x[ok]
    y <- y[ok]
    if (length(x) < 2L) {
        return(NULL)
    }
    fit <- least_squares(x, y)
    if (is.null(fit)) {
        return(NULL)
    }
    list(
        population = as.numeric(x),
        population_y = as.numeric(y),
        slope = fit$slope,
        intercept = fit$intercept
    )
}

preview_num_num <- function(widget) {
    extract_num_num_population(widget)
}

reset_num_num_state <- function(widget) {
    widget$population_y <- numeric(0)
    widget$population_intercept <- 0
}

#' Draw SRS replicates; sample_stats are least-squares slopes.
compute_num_num_sampling <- function(
    x,
    y,
    sample_size,
    num_reps = NUM_REPS,
    progress_callback = NULL) {
    n_pop <- length(x)
    if (n_pop != length(y) || n_pop < 2L) {
        stop("Population must have at least two paired points", call. = FALSE)
    }
    sample_size <- as.integer(sample_size)
    if (sample_size < 2L || sample_size > n_pop) {
        stop(
            "Sample size must be between 2 and ",
            n_pop,
            call. = FALSE
        )
    }

    pop_fit <- least_squares(x, y)
    if (is.null(pop_fit)) {
        stop("Cannot fit a slope to the population", call. = FALSE)
    }

    pop_domain <- scale_domain(x)
    sample_stats <- numeric(num_reps)
    pool_reps <- min(num_reps, ANIM_POOL_SIZE)
    sample_indices <- integer(pool_reps * sample_size)
    idx_offset <- 0L

    for (i in seq_len(num_reps)) {
        # Resample until the sample has a defined slope (non-zero x variance).
        fit <- NULL
        idx <- integer(0)
        tries <- 0L
        while (is.null(fit) && tries < 50L) {
            tries <- tries + 1L
            idx <- sample.int(n_pop, sample_size, replace = FALSE)
            fit <- least_squares(x[idx], y[idx])
        }
        if (is.null(fit)) {
            stop("Unable to draw samples with a defined slope", call. = FALSE)
        }
        sample_stats[[i]] <- fit$slope
        if (i <= pool_reps) {
            sample_indices[(idx_offset + 1L):(idx_offset + sample_size)] <- idx - 1L
            idx_offset <- idx_offset + sample_size
        }

        if (!is.null(progress_callback) && (i %% 50L == 0L || i == num_reps)) {
            progress_callback(as.integer(floor(100 * i / num_reps)))
        }
    }

    finite_slopes <- sample_stats[is.finite(sample_stats)]
    dist_domain <- if (length(finite_slopes) > 0L) {
        scale_domain(c(finite_slopes, pop_fit$slope))
    } else {
        c(pop_fit$slope - 1, pop_fit$slope + 1)
    }

    list(
        population = as.numeric(x),
        population_y = as.numeric(y),
        population_stat = pop_fit$slope,
        population_intercept = pop_fit$intercept,
        sample_stats = sample_stats,
        sample_indices = sample_indices,
        scales = list(
            pop = pop_domain,
            sample = pop_domain,
            dist = dist_domain
        ),
        dist_y = numeric(0),
        sample_size = sample_size,
        stat_kind = "slope"
    )
}
