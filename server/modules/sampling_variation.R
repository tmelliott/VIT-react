samplingVariation <- createWidget(
    "samplingVariation",
    properties = list(
        vit = "ANY",
        variables = ts_character(0L, default = ""),
        xvar = ts_character(1L, default = ""),
        yvar = ts_character(1L, default = ""),
        sample_size = ts_integer(1L, default = 20),
        statistic = ts_character(1L, default = "mean")
    ),
    initialize = function(widget, parent = NULL) {
        NULL
    }
)
