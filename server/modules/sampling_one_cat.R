#' One-categorical-variable proportion sampling variation engine.

encode_loi <- function(x, loi = NULL) {
    x <- as.character(x)
    xlevels <- sort(unique(x))
    if (length(xlevels) < 2L) {
        stop("Categorical variable needs at least 2 levels", call. = FALSE)
    }
    focus <- if (is.null(loi) || !nzchar(loi) || !(loi %in% xlevels)) {
        xlevels[[1L]]
    } else {
        loi
    }
    alt <- if (length(xlevels) > 2L) "All Else" else xlevels[xlevels != focus][[1L]]
    encoded <- ifelse(x == focus, 0L, 1L)
    list(
        encoded = as.integer(encoded),
        loi = focus,
        loi_alt = alt,
        x_levels = as.character(xlevels),
        category_labels = c(focus, alt)
    )
}

calc_proportion <- function(encoded) {
    if (length(encoded) == 0L) {
        return(NA_real_)
    }
    mean(encoded == 0L)
}

proportion_domain <- function(props, pad = 0.05) {
    if (length(props) == 0L) {
        return(c(0, 1))
    }
    rng <- range(props, na.rm = TRUE)
    if (!is.finite(rng[[1L]]) || !is.finite(rng[[2L]])) {
        return(c(0, 1))
    }
    if (diff(rng) == 0) {
        half <- max(0.05, rng[[1L]] * 0.1)
        rng <- c(max(0, rng[[1L]] - half), min(1, rng[[2L]] + half))
    } else {
        pad_amount <- diff(rng) * pad
        rng <- c(max(0, rng[[1L]] - pad_amount), min(1, rng[[2L]] + pad_amount))
    }
    rng
}

extract_one_cat_population <- function(widget) {
    d <- parent_data(widget)
    xvar <- widget$xvar
    if (is.null(d) || !nzchar(xvar) || !xvar %in% names(d)) {
        return(NULL)
    }
    x <- as.character(d[[xvar]])
    ok <- !is.na(x) & nzchar(x)
    if (!any(ok)) {
        return(NULL)
    }
    loi <- if (nzchar(widget$loi)) widget$loi else NULL
    enc <- encode_loi(x[ok], loi)
    list(
        encoded = enc$encoded,
        loi = enc$loi,
        loi_alt = enc$loi_alt,
        x_levels = enc$x_levels,
        category_labels = enc$category_labels
    )
}

preview_one_cat <- function(widget) {
    dat <- extract_one_cat_population(widget)
    if (is.null(dat)) {
        return(NULL)
    }
    list(
        population_category = dat$encoded,
        loi = dat$loi,
        loi_alt = dat$loi_alt,
        x_levels = dat$x_levels,
        category_labels = dat$category_labels,
        population_stat = calc_proportion(dat$encoded),
        n_groups = 2L
    )
}

compute_one_cat_sampling <- function(
    encoded,
    sample_size,
    num_reps = NUM_REPS,
    progress_callback = NULL) {
    n_pop <- length(encoded)
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

    population_stat <- calc_proportion(encoded)
    # Pop/sample axes are always [0, 1] so the proportion bar spans the pane.
    # Dist axis uses the sampling distribution range.
    pop_domain <- c(0, 1)

    sample_stats <- numeric(num_reps)
    pool_reps <- min(num_reps, ANIM_POOL_SIZE)
    sample_indices <- integer(pool_reps * sample_size)
    idx_offset <- 0L

    for (i in seq_len(num_reps)) {
        idx <- sample.int(n_pop, sample_size, replace = FALSE)
        sample_stats[[i]] <- calc_proportion(encoded[idx])
        if (i <= pool_reps) {
            sample_indices[(idx_offset + 1L):(idx_offset + sample_size)] <- idx - 1L
            idx_offset <- idx_offset + sample_size
        }

        if (!is.null(progress_callback) && (i %% 50L == 0L || i == num_reps)) {
            progress_callback(as.integer(floor(100 * i / num_reps)))
        }
    }

    dist_domain <- proportion_domain(sample_stats[is.finite(sample_stats)])

    list(
        population_category = as.integer(encoded),
        population_stat = population_stat,
        stat_kind = "proportion",
        n_groups = 2L,
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

#' Clear computed categorical preview fields (not user-selected loi).
reset_cat_preview_data <- function(widget) {
    widget$population_category <- integer(0)
    widget$loi_alt <- ""
    widget$x_levels <- character(0)
    widget$category_labels <- character(0)
}
