#' One-numeric-variable sampling variation engine.
NUM_REPS <- 1000L
#' Sample index rows kept for client animation (stats still computed for all reps).
ANIM_POOL_SIZE <- 100L

sample_statistic <- function(x, statistic = c("mean", "median")) {
    statistic <- match.arg(statistic)
    x <- x[is.finite(x)]
    if (length(x) == 0L) {
        return(NA_real_)
    }
    if (statistic == "mean") {
        mean(x)
    } else {
        stats::median(x)
    }
}

scale_domain <- function(x, pad = 0.05) {
    if (length(x) == 0L) {
        return(c(0, 1))
    }
    rng <- range(x, na.rm = TRUE)
    if (diff(rng) == 0) {
        rng <- rng + c(-1, 1)
    }
    pad_amount <- diff(rng) * pad
    c(rng[[1L]] - pad_amount, rng[[2L]] + pad_amount)
}

compute_one_num_sampling <- function(
    population,
    sample_size,
    statistic = c("mean", "median"),
    num_reps = NUM_REPS,
    progress_callback = NULL) {
    statistic <- match.arg(statistic)
    n_pop <- length(population)
    if (n_pop == 0L) {
        stop("Population is empty", call. = FALSE)
    }
    sample_size <- as.integer(sample_size)
    if (sample_size < 1L || sample_size > n_pop) {
        stop(
            "Sample size must be between 1 and ",
            n_pop,
            call. = FALSE
        )
    }

    population_stat <- sample_statistic(population, statistic)
    pop_domain <- scale_domain(population)

    sample_stats <- numeric(num_reps)
    pool_reps <- min(num_reps, ANIM_POOL_SIZE)
    sample_indices <- integer(pool_reps * sample_size)
    idx_offset <- 0L

    for (i in seq_len(num_reps)) {
        idx <- sample.int(n_pop, sample_size, replace = FALSE)
        sample_vals <- population[idx]
        sample_stats[[i]] <- sample_statistic(sample_vals, statistic)
        if (i <= pool_reps) {
            sample_indices[(idx_offset + 1L):(idx_offset + sample_size)] <- idx - 1L
            idx_offset <- idx_offset + sample_size
        }

        if (!is.null(progress_callback) && (i %% 50L == 0L || i == num_reps)) {
            progress_callback(as.integer(floor(100 * i / num_reps)))
        }
    }

    dist_domain <- scale_domain(sample_stats)

    list(
        population = as.numeric(population),
        population_stat = population_stat,
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

parent_data <- function(widget) {
    parent <- widget$vit
    if (is.null(parent)) {
        parent <- widget$.parent
    }
    if (is.null(parent)) {
        return(NULL)
    }
    parent$data
}

numeric_column_names <- function(d) {
    if (is.null(d) || !is.data.frame(d)) {
        return(character(0))
    }
    names(d)[vapply(d, is.numeric, logical(1))]
}

extract_population <- function(widget) {
    d <- parent_data(widget)
    xvar <- widget$xvar
    if (is.null(d) || !nzchar(xvar) || !xvar %in% names(d)) {
        return(NULL)
    }
    x <- as.numeric(d[[xvar]])
    x <- x[is.finite(x)]
    if (length(x) == 0L) {
        return(NULL)
    }
    x
}

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
}
