---
layout: post
title: "Let's solve more learning rules"
date: 2024-06-05 01:00
category: research
---


*TLDR: the field now has an “omniscient solution" for the generalization of linear regression. We should try to find comparable solutions for other simple learning rules, like k-nearest-neighbors and kernel smoothing!
This post is motivation for [part two]({{site.baseurl}}/blog/1nn-eigenframework), where I give a partial omniscient solution to the nearest-neighbor algorithm.*

## Intro: what does it mean to “solve” a learning rule?

Essentially all of machine learning theory aims to understand the performance and behavior of different schemes for making predictions on unseen data. This is often very difficult. Given the amount of effort expended in this direction, it’s worth stepping back and asking what we’re ultimately trying to do here — that is, how will we know when we’re done?

To me, one gold-standard answer is the following: **for each learning rule under study, we want a simple set of equations that tells us how well the learning rule will perform** in terms of the task eigenstructure and number of samples $n$**.** This isn’t the only thing we might want, but it’s clearly a powerful milestone: you could use such a theory to work out when the algorithm will perform well or poorly, and in order to derive the theory you’d have to understand a lot about the behavior of the learning rule. Viewing each learning rule as presenting a puzzle for theorists, I’d consider the development of such a theory as tantamount to “solving” the learning rule.

An important clarification is that this is an “omniscient” solution in the sense that you assume complete and exact knowledge of the training task. This isn’t very useful by itself as a practical tool, but it is very useful for conceptual understanding of the learning rule (e.g. for characterizing its inductive bias). In light of this, to be more precise, we'll say that this sort of theory is an "omniscient solution" for a learning rule.

In my view, one of the most significant recent developments in machine learning theory is that *we have an omniscient solution for linear regression!* That is, thanks to [lots](https://papers.nips.cc/paper_files/paper/2001/hash/d68a18275455ae3eaa2c291eebb46e6d-Abstract.html) [and](https://www.arxiv.org/abs/2002.02561) [lots](https://arxiv.org/abs/2006.09796) [of](https://arxiv.org/abs/2210.08571) [recent](https://proceedings.neurips.cc/paper/2021/file/9704a4fc48ae88598dcbdcdf57f3fdef-Paper.pdf) [papers](https://arxiv.org/abs/1903.08560), we now have a simple set of closed-form equations that accurately predict the test performance of linear regression in terms of the task eigenstructure.

Here’s some flavor for how this theory looks. First, we define an orthonormal basis of functions $\{ \phi_k \}$ over the input space. (In the case of linear regression, these are linear functions and are the principal directions of the feature covariance matrix.) We then decompose the target function $f$ into this basis as

$$
f(x) = \sum_k v_k \phi_k(x)
$$

where $\{ v_k \}$ are the eigencoefficients. (Noise may also be included, but I omit it here for simplicity.) The eigenframework then takes the form

$$
\text{test MSE} = \sum_k g(n, k)  \, v_k^2,
$$

where $g(n,k)$ tells you what fraction of the signal in mode $k$ contributes to test error at $n$ samples. (The function $g(n,k)$ typically decreases to zero as $n$ grows.)

Here are some remarkable facts about this eigenframework:

- It gives accurate predictions of test MSE even on real data!
- The eigenmodes don’t interact! That is, there are no crossterms $v_j v_k$ in the final expression.
- It’s very mathematically simple! In particular, the function $g$ isn’t too complicated, I just didn’t want to get into the details here. It’s simple enough that you can study it in various limits to really get intuition for how linear regression generalizes.

**I’m a big fan of results of this type.** They feel like the way to make progress in this field: rather than showing every new result from square one, first we derive this simple and general eigenframework *once,* and then can use it as a starting point to compute other quantities — error bounds, convergence rates, effects of dimensionality, effects of regularization, and more.[^1]

[^1]: To illustrate this point, [here](https://arxiv.org/abs/2207.06569) [are](https://arxiv.org/pdf/2306.13185) [four](https://arxiv.org/abs/2311.14646) [papers](https://arxiv.org/abs/2110.03922) in which I’ve used this eigenframework as a starting point to easily derive other results.

This is how physics (and specifically statistical mechanics) works — when studying a complex system, you first seek a simple effective theory for the system, and then can easily ask lots of downstream questions about the *effective* theory.

## Call to action: *let’s solve more learning rules!*

The above omniscient solution for linear regression has been very impactful. We should try to do this for more learning rules.

Learning rules like k-nearest-neighbors (kNN), kernel smoothing, spline interpolation, decision trees, clustering, SVMs, and generalized additive models are widely used in practice, but we do not understand any of them as well as we now understand linear regression. It would be very impactful to solve any of them. Furthermore, the first three — kNN, kernel smoothing, and spline interpolation — are *linear* learning rules in the sense that the predicted function depends linearly on the training targets (i.e., the training $y$’s), which suggests that an eigenframework of the *same* type as that for linear regression might be possible. These last three seem simple enough that you might be able to solve them in one paper![^2]

[^2]: Two other learning rules: obviously we’d all love to understand neural networks, but they’re still too poorly understood for a theory of generalization, I think — we need to understand more about their dynamics first. Second, random feature (RF) regression is a nice generalization of linear regression — and I derived an eigenframework for RF regression for [a recent paper](https://arxiv.org/abs/2311.14646) ;)

I suspect that omnisciently solving more learning rules would have a large impact — potentially a paradigm-altering impact, actually. Right now, all these learning rules are just a bag of disjoint algorithms: we don’t really understand any of them individually, and we sure don’t understand how they relate to each other. Any intuition I have about their relative performance is extremely ad-hoc — for example, kNN works best in low dimensions and at low noise, SVMs are often better in high dimensions, decision trees work well when different features have different notions of distance, and so on. **If we understood all these learning rules in the same way as we understand linear regression, we could compare them on the same footing!** Instead of a bunch of ad-hoc intuitions, we could start to think of all these learning rules in one unified way. This feels like a place that machine learning ought to eventually get to.

In [part two]({{site.baseurl}}/blog/1nn-eigenframework), I’ll give the solution for 1NN on the unit circle and 2-torus and discuss what it might look like to solve 1NN in general!

***