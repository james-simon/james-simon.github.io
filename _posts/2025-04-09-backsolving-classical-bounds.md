---
layout: post
title: "Backsolving classical generalization bounds from the modern kernel regression eigenframework"
date: 2025-04-09
category: kernels
emoji: 🔄
---

*This blogpost shows how to use the omniscient KRR eigenframework, which gives a closed-form expression for the test error of KRR in terms of task eigenstructure, to quickly recover a classical generalization bound. I’ve worked with the modern eigenframework a great deal, and this blogpost was the result of a calculation I thought was new but quickly resolved to a classical bound. Even though the old classical bounds have proven fairly useless in modern problems, I still found this interesting: the calculation here presented is a different (and fast) way to arrive at a classical result, and it was clarifying for me to see where the looseness of the classical result slips in in the course of various approximations.*

***

We will take as starting point the KRR eigenframework derived in many recent papers. We will use the notation of [our KRR eigenpaper](https://arxiv.org/abs/2110.03922) with little further explanation.

### Setup

We have a target function $f\_*(\cdot)$ and a kernel function $K(\cdot,\cdot)$. We know the target function’s RKHS norm $\lvert \\! \lvert f_\ast \rvert \\! \rvert_K$. We will perform KRR with $n$ samples from an arbitrary measure $\mu$, and we would like to obtain a bound on the test error at optimal ridge

$$
\text{[test MSE]}|_{\delta = \delta_*} \equiv \mathbb{E}_{x \sim \mu}[(f_*(x) - \hat{f}(x))^2].
$$

We know $\max\_{x \sim \mu} K(x,x)$, where the max runs over the support of $\mu$, or at least we know an upper bound for this quantity.

### Rewriting known quantities in the kernel eigensystem

There exists a kernel eigendecomposition $K(x,x') = \sum\_i \lambda\_i \phi\_i(x) \phi\_i(x')$ which is orthonormal w.r.t. $\mu$, though we will not need to assume that we can find it. There also exists a decomposition $f\_*(x) = \sum\_i v\_i \phi\_i(x)$, though we again do not assume we can find it.

It holds that

$$
|\!| f_* |\!|_K^2 = \sum_i \frac{v_i^2}{\lambda_i}.
$$

Note that this is true regardless of the measure $\mu$ — see my note on measure-independent properties of kernel eigensystems.

### Using the kernel eigenframework

The effective ridge $\kappa > 0$ is the unique positive solution to

$$
n = \sum_i \mathcal{L}_i \ + \ \frac{\delta}{\kappa},
$$

where $\mathcal{L}\_i := \frac{\lambda\_i}{\lambda\_i + \kappa} \in [0,1]$ is the “learnability” of mode $i$. We will go head and choose $\delta$ such that $\sum\_i \mathcal{L}\_i = \frac{n}{2}$, which will later give us the best constant prefactor in our bound.

The eigenframework states that

$$
\text{[test MSE]} \approx \mathcal{E} := \frac{n}{n - \sum_i \mathcal{L}_i^2} \sum_i (1 - \mathcal{L}_i)^2 v_i^2.
$$

We may now note three useful bounds. First, we may bound the prefactor above as

$$
\frac{n}{n - \sum_i \mathcal{L}_i^2} \le \frac{n}{n - \sum_i \mathcal{L}_i} = 2,
$$

where in the last step we have applied our choice of $\delta$. Second, we may bound the sum as

$$
\sum_i (1 - \mathcal{L}_i)^2 v_i^2 
\ \le \ \sum_i (1 - \mathcal{L}_i) v_i^2
\ = \ \sum_i \frac{v_i^2}{\lambda_i} \frac{\kappa \lambda_i}{\lambda_i + \kappa}
\ \le \ \kappa \cdot \sum_i \frac{v_i^2}{\lambda_i} \le \kappa \cdot |\!| f_* |\!|_K^2.
$$

Finally, noting that $\sum\_i \frac{\lambda\_i}{\kappa} \ge \sum\_i \mathcal{L}\_i = \frac{n}{2}$, we may bound the constant $\kappa$ as

$$
\kappa < \frac{2}{n} \sum_i \lambda_i = \frac{2 \cdot \text{Tr}[K]}{n} = \frac{2 \cdot \mathbb{E}_{x \sim \mu}[K(x,x)]}{n} \le \frac{2 \cdot \max_{x \sim \mu}K(x,x)}{n}.
$$

Putting the above four equations together (and also using the fact that the test MSE at optimal ridge will be less than or equal to the test MSE at our chosen ridge), we find that

$$
\boxed{\mathcal{E}|_{\delta = \delta_*} \le \frac{4 \cdot \max_{x \sim \mu} K(x,x)}{n} \cdot |\!| f_* |\!|_K^2.}
$$

This looks like a classical generalization bound! It seems to me like this sort of classical bound often doesn’t have one canonical statement but instead gets written many different ways (which I suppose makes sense if your equation is a fairly loose bound that you could tighten up in some places and loosen in others), and I couldn’t find an exact statement of precisely this form anywhere, so I suppose I’m not actually sure this is equivalent to a classical result (though ChatGPT assures me it is), but it certainly looks like lots of classical bounds I’ve seen.

If we use the fact that $\lvert \! \lvert f_\ast \rvert \! \rvert_{L^2(\mu)}^2 = \sum_i v_i^2$, we can obtain the (to me more illuminating) result that

$$
\frac{\mathcal{E}|_{\delta = \delta_*}}{\mathcal{E}|_{\delta \rightarrow \infty}} \le \frac{4 \cdot \max_{x \sim \mu} K(x,x)}{n} \cdot \frac{|\!| f_* |\!|_K^2}{|\!| f_* |\!|_{L^2(\mu)}^2}.
$$

That is, the ratio of test error with $n$ samples to the naive test error of the zero predictor is controlled by the ratio of the RKHS norm of the target function to the $L^2$ norm of the target function.