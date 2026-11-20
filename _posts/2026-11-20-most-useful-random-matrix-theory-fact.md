---
layout: post
title: "The most useful random matrix theory fact I know"
date: 2026-11-20 07:00:00
category: kernels
emoji: 🎲
---

I've written a lot of papers deriving and using theories of the learning behavior of kernel regression and random feature regression. It's only a small exaggeration to say that all that work uses only one random matrix theory calculation. Here it is.

<div style="display: none">
$$
\newcommand{\bm}[1]{\boldsymbol{#1}}
\newcommand{\E}[2]{\mathbb{E}_{#1} \! \left[ #2 \right]}
\newcommand{\diag}[1]{\operatorname{diag}{#1}}
\newcommand{\Tr}[1]{\operatorname{Tr}\left[{#1}\right]}
\newcommand{\norm}[1]{\left| \! \left| #1 \right| \! \right|}
\newcommand{\e}{\mathcal{E}}
\newcommand{\N}{\mathcal{N}}
\newcommand{\R}{\mathbb{R}}
\newcommand{\vv}{\bm{v}}
\newcommand{\vw}{\bm{w}}
\newcommand{\vx}{\bm{x}}
\newcommand{\mI}{\bm{I}}
\newcommand{\mX}{\bm{X}}
\newcommand{\mLambda}{\bm{\Lambda}}
\newcommand{\mPi}{\bm{\Pi}}
$$
</div>

Let $\mX = [\vx\_1, \ldots, \vx\_n] \in \R^{d \times n}$ be a random matrix with i.i.d. columns drawn as $\vx\_i \sim \N(0, \mLambda)$, with $d > n$. We'll take $\mLambda$ to be diagonal: $\mLambda = \diag(\lambda\_1, \dots, \lambda\_d)$. When studying kernel regression, one is interested in the projector onto the column-space of $\mX$: that is, $\mPi := (\mX \mX^\top)^0 = \mX (\mX^\top \mX)^{-1} \mX^\top$. The central fact is the following:

$$
\boxed{\begin{gathered} \E{\mX}{\mPi} \approx \frac{\mLambda}{\mLambda + \kappa \mI_d}, \\ \text{where} \ \kappa \ge 0 \ \text{satisfies} \ \Tr{\E{\mX}{\mPi}} \approx \sum_{i=1}^{d} \frac{\lambda_i}{\lambda_i + \kappa} = n. \end{gathered}}
$$

The "$\approx$" above deserves discussion. It becomes an equality in certain natural high-dimensional limits and carries bounds at finite dimension, and formal statements of this fact involve either a limit or bounds of this nature. I write it without these because, at quite modest $d, n$, this fact tends to simply hold very well. Here's a widget that lets you see that for yourself:

{% include rmt-fact-widget.html %}

This fact may be derived many ways: random matrix theory, the replica method, or [a cavity/leave-one-out calculation which uses the Sherman-Morrison formula.](https://dkarkada.xyz/posts/sherman-morrison/) My paper on the generalization eigenframework for kernel regression only used this fact and a derivative of this fact w.r.t. $\mLambda$ [[1](https://arxiv.org/abs/2110.03922)]. My paper on the eigenframework for random feature regression just used this fact twice (once for samples and once for features), plus some derivatives [[2](https://arxiv.org/abs/2311.14646)].

When does this come up? Consider the case of linear regression. Suppose that our data is drawn $\vx\_i \sim \N(0, \mLambda)$, and our target function is $f\_\*(\vx) = \langle \vw\_\*, \vx \rangle$. Then linear regression gives you the predicted coefficients $\hat{\vw} = \mPi \vw\_\*$, where $\mPi$ is the same projector as above. The expected test-time MSE is then

$$
\e = \E{\mX}{\norm{\mLambda^{1/2} \left(\hat{\vw} - \vw_* \right)}^2} = \E{\mX}{\vw_*^\top (\mI_d - \mPi) \mLambda (\mI_d - \mPi) \vw_*}.
$$

Once you understand the first- and second-order statistics of $\mPi$, then, you have an eigenframework for the expected test MSE.[^1]

In conclusion, this is a workhorse identity of learning mechanics (aka fundamental mathematical science of deep learning), it's very useful for computing theories that describe things like spectral bias and overfitting, and I highly recommend folks learn it :)

***

[^1]: For members of my lab or readers of my papers, note that I prefer to work with normalized eigenfunctions and their coefficients $\vv\_\* = \mLambda^{-1/2} \vw\_\*$, in terms of which the MSE is $\e = \E{\mX}{\vv\_\*^\top \mLambda^{-1/2}  (\mI\_d - \mPi) \mLambda (\mI\_d - \mPi) \mLambda^{-1/2} \vv\_\*}.$
