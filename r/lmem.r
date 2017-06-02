library(lme4)
library(plyr)
library(stringr)

add_numericized_factor <- function(df, fct) {
    df[[fct]] <- factor(df[[fct]])
    n <- nlevels(df[[fct]])
    if (n == 2) {
        df[[paste0(fct, 1)]] <- sapply(df[[fct]], 
            function(i) contr.sum(2)[i])
    }
    else {
        fct_numeric <- sapply(df[[fct]], function(i) contr.sum(n)[i,])
        for (i in 1:(n-1)) {
            df[[paste0(fct, i)]] <- fct_numeric[i,]
        }
    }
    return(df)
}

simplify_anova <- function(model, full_model) {
    anova_object <- anova(model, full_model)
    data.frame(
        p_value=anova_object[['Pr(>Chisq)']][2],
        chi=anova_object[['Chisq']][2],
        chi_df=anova_object[['Chi Df']][2])
}

# copied from http://tolstoy.newcastle.edu.au/R/help/04/06/0217.html
with_warnings <- function(expr) {
    myWarnings <- NULL
    wHandler <- function(w) {
        myWarnings <<- c(myWarnings, list(w))
        invokeRestart("muffleWarning")
    }
    val <- withCallingHandlers(expr, warning = wHandler)
    list(value=val, warnings=myWarnings)
} 

fit_logistic <- function(fml, df) {
    glmer(formula(fml), family=binomial, data=df,
        control=glmerControl(optimizer="bobyqa"))
}

fit_linear <- function(fml, df) {
    lmer(formula(fml), data=df, REML=FALSE)
}

fit_multiple <- function(df, formulas, fit_one, verbose=FALSE) {
    wrapped <- function(x) {
        if (verbose) print(x)
        with_warnings(fit_one(x, df))
    }
    models_with_warnings <- llply(formulas, wrapped)
    return(models_with_warnings)
}

simplified_anova <- function(models_with_warnings, null_bayes_factor=FALSE) {
    models <- llply(models_with_warnings, function(x) x$value)
    warnings <- llply(models_with_warnings, function(x) x$warnings)
    partial_models <- models[names(models) != '.full']
    partial_warnings <- !is.null(unlist(warnings[names(warnings) != '.full']))
    curried <- function(x) simplify_anova(x, models[['.full']])
    anova_df <- ldply(partial_models, curried, .id='term')
    if (null_bayes_factor) {
        anova_df$bic <- unlist(llply(partial_models, BIC))
        full_bic <- BIC(models[['.full']])
        anova_df$null_bayes_factor <- exp((full_bic - anova_df$bic) / 2)
    }
    anova_df$warnings <- unlist(partial_warnings)
    ncolons <- str_count(anova_df$term, ':')
    levels <- anova_df$term[order(ncolons, as.character(anova_df$term))]
    anova_df$term <- factor(anova_df$term, levels=levels)
    anova_df <- anova_df[order(anova_df$term),]
    rownames(anova_df) <- c()
    return(anova_df)
}

make_term_string <- function(ns) {
    grid <- do.call(expand.grid, llply(ns, function(x) c(1:x)))
    args <- list()
    for (n in names(ns)) {
        args <- c(args, n, list(grid[[n]]), ':')
    }
    args[[length(args)]] <- NULL    # remove last colon
    string <- do.call(paste0, args)
    return(string)
}

#' @param subject_slopes  a vector of all subject slopes; interactions need
#'      to be specified explicitly (e.g., c('var1', 'var2', 'var1:var2'))
#' @param subject_slope_correl  boolean: include subject slope correlations?
#'      In terms of lme4 formulas: (1 + v1 | subj) vs. (1 + v1 || subj)
#' @param item_var   NULL if no item random effect (default), or a string
#'      with the name of the item field (for items only random intercept is 
#'      supported at this point)
#' @param verbose    
lmer_anova <- function(df, fit_one, response_var, factors, subject_slopes, 
    subject_slope_correl=TRUE, item_var=NULL, subject_var='subject', 
    verbose=FALSE, return_models=FALSE, null_bayes_factor=FALSE) {

    ns <- list()
    for (factor in factors) {
        df <- add_numericized_factor(df, factor)
        ns[[factor]] <- nlevels(df[[factor]]) - 1
    }

    terms <- list()
    for (i in factors) {    
        terms[[i]] <- make_term_string(ns[i])
        if (length(factors) > 1) {
            other <- factors[factors != i]
            label <- do.call(paste, as.list(c(other, sep=':')))
            terms[[label]] <- make_term_string(ns[names(ns) != i])
        }
    }

    intr_name <- do.call(paste, as.list(c(factors, sep=':')))
    terms[[intr_name]] <- make_term_string(ns)

    subj_terms <- c('1')
    if (length(subject_slopes) > 0) {
        subj_terms <- c(subj_terms, unlist(terms[subject_slopes]))
    }
    ranef <- sprintf('(%s %s %s)',
        do.call(paste, as.list(c(subj_terms, sep=' + '))),
        ifelse(subject_slope_correl, '|', '||'),
        subject_var)
    if (!is.null(item_var)) {
        ranef <- paste(ranef, sprintf('+ (1 | %s)', item_var))
    }

    to_formula <- function(args) {
        args <- c(args, ranef, sep=' + ')
        paste(response_var, '~', do.call(paste, as.list(args)))
    }

    formulas <- llply(names(terms), function(term) {
        to_formula(unlist(terms[names(terms) != term]))
    })
    names(formulas) <- names(terms)
    formulas[['.full']] <- to_formula(unlist(terms))
    models <- fit_multiple(df, formulas, fit_one, verbose=verbose)
    sa <- simplified_anova(models, null_bayes_factor=null_bayes_factor)
    if (return_models) {
        return(list(df=sa, models=models))
    }
    else {
        return(sa)
    }
}

simple_effects <- function(df, fit_one, across_var, response_var, factors,
    subject_slopes, subject_slope_correl=TRUE, item_var=NULL,
    subject_var='subject', verbose=FALSE, return_models=FALSE,
    null_bayes_factor=FALSE) {

    df[[across_var]] <- factor(df[[across_var]])
    models <- list()
    results <- ldply(levels(df[[across_var]]), function(x) {
        subdf <- df[df[[across_var]] == x,]
        if (verbose) {
            print(sprintf('%s = %s:', across_var, x))
        }
        lma <- lmer_anova(subdf, fit_one, response_var, factors,
            subject_slopes, subject_slope_correl, item_var, subject_var,
            verbose, return_models=TRUE, null_bayes_factor=null_bayes_factor)
        lma$df[[across_var]] <- x
        names(lma$models) <- paste0(sprintf('%s=%s|', across_var, x),
            names(lma$models))
        models <<- c(models, lma$models)
        return(lma$df)
    })
    # Rearrange columns
    results <- results[c(length(results), 1:(length(results) - 1))]
    results <- results[order(results[[across_var]], results$term),]
    row.names(results) <- c()
    if (return_models) {
        return(list(df=results, models=models))
    }
    else {
        return(results)
    }
}

lmer_anova_maybecorrel <- function(df, fit_one, response_var, factors,
    subject_slopes, item_var='onset', subject_var='subject', verbose=FALSE,
    null_bayes_factor=FALSE) {

    anv <- lmer_anova(df, fit_one, response_var, factors,
        subject_slopes, subject_slope_correl=TRUE, item_var=item_var,
        subject_var=subject_var, verbose=verbose)
    anv$subject_slope_correl <- TRUE

    if (any(anv$warnings)) {
        nocorrel <- lmer_anova(df, fit_one, response_var, factors,
            subject_slopes, subject_slope_correl=FALSE, item_var=item_var,
            subject_var=subject_var, verbose=verbose,
            null_bayes_factor=null_bayes_factor)
        nocorrel$subject_slope_correl <- FALSE
        anv <- rbind(anv, nocorrel)
    }

    anv <- anv[c(length(anv), 1:(length(anv) - 1))]
    return(anv)
}

simple_effects_maybecorrel <- function(df, fit_one, across_var,
    response_var, factors, subject_slopes, item_var='onset',
    subject_var='subject', verbose=FALSE, null_bayes_factor=FALSE) {

    simpef <- simple_effects(df, across_var, response_var, factors,
        subject_slopes, subject_slope_correl=TRUE, item_var=item_var,
        subject_var=subject_var, verbose=verbose,
        null_bayes_factor=null_bayes_factor)
    simpef$subject_slope_correl <- TRUE

    if (any(simpef$warnings)) {
        nocorrel <- simple_effects(df, across_var, response_var, factors,
            subject_slopes, subject_slope_correl=FALSE, item_var=item_var,
            subject_var=subject_var, verbose=verbose)
        nocorrel$subject_slope_correl <- FALSE
        simpef <- rbind(simpef, nocorrel)
    }

    simpef <- simpef[c(length(simpef), 1:(length(simpef) - 1))]
    return(simpef)
}
