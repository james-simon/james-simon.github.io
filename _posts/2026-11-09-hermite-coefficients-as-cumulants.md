---
layout: post
title: "Hermite coefficients as cumulants"
date: 2026-11-09 07:00:00
category: mathematics
emoji: ☁️
---

Here's a terrific fact. Suppose that we have Gaussian data $\mathbf{x} \sim \mathcal{N}(0, \boldsymbol{\Sigma})$ with positive-definite covariance $\boldsymbol{\Sigma} \in \mathbb{R}^{d \times d}$ and deterministic scalar targets $y = f(\mathbf{x})$. To set up the fact, we need to break $f$ down into the Hermite basis of $\mathbf{x}$. First take $\boldsymbol{\Sigma} = \mathbf{U} \boldsymbol{\Gamma} \mathbf{U}^\top$, and define normalized coordinates $\mathbf{z} = \boldsymbol{\Gamma}^{-1/2} \mathbf{U}^\top \mathbf{x}$. Let $h\_{\boldsymbol{\alpha}}(\mathbf{z})$ be the (normalized, probabilist's) Hermite polynomial corresponding to multi-index $\boldsymbol{\alpha}$, and let $h^{(\boldsymbol{\Sigma})}\_\boldsymbol{\alpha}(\mathbf{x})$ be the same function in the original coordinates ($\mathbf{x}$-space, not $\mathbf{z}$-space). Let $c\_\boldsymbol{\alpha} = \langle f, h^{(\boldsymbol{\Sigma})}\_\boldsymbol{\alpha} \rangle$ be the Hermite coefficients of $f$, such that $f(\mathbf{x}) = \sum\_\boldsymbol{\alpha} c\_\boldsymbol{\alpha} \cdot h^{(\boldsymbol{\Sigma})}\_\boldsymbol{\alpha}(\mathbf{x})$.

Now here's the fact. Consider the cumulants of the joint variable $(\mathbf{x}, y)$. Specifically, consider the cumulants that involve some number of normalized coordinates of $\mathbf{x}$ and are *linear* in $y$. These are *equal* to the corresponding Hermite coefficients of $f$, times a combinatorial factor. Specifically, consider $\ell$ of these normalized variables $\\{z\_{i\_j}\\}\_{j=1}^\ell$ and construct the multi-index $\boldsymbol{\alpha} \in \mathbb{N}^d$ where $\alpha\_k = \\#\\{j : \  i\_j = k\\}$. Then it holds that

$$
\kappa[z_{i_1}, \ \ldots, \ z_{i_\ell}, \ y] = c_\boldsymbol{\alpha} \cdot \sqrt{\boldsymbol{\alpha}!},
$$

where $\boldsymbol{\alpha}! = \prod\_i \alpha\_i!$. More generally, if the first $\ell$ arguments are general linear directions, then we get

$$
\kappa \left[ \mathbf{u}_1 \cdot \mathbf{z}, \ \ldots, \ \mathbf{u}_\ell \cdot \mathbf{z}, \ y \right] = \left\langle \mathcal{T}^{(\ell)}, \mathbf{u}_1 \otimes \cdots \otimes \mathbf{u}_\ell \right\rangle,
$$

where $\mathcal{T}^{(\ell)}$ is the $\ell$-tensor with elements $\mathcal{T}^{(\ell)}\_{(i\_1, \ldots, i\_\ell)} = c\_\boldsymbol{\alpha} \cdot \sqrt{\boldsymbol{\alpha}!}$, where $\alpha\_k = \\#\\{j : \  i\_j = k\\}$. This general formula follows from the special-case formula and multilinearity of the cumulant.

This fact is so terrific because it links together supervised and unsupervised learning. It's simpler to have a distribution over only one space rather than over two, and supervised learning is a pain to study because the $y$'s are awkwardly in a different space than the $\mathbf{x}$'s. One candidate unifying principle for all of AI is that of *cumulant learning,* and supervised learning is really just learning particular cumulants of the joint distribution $(\mathbf{x}, y)$ -- namely, those with a linear dependence on $y$. This formula relates those cumulants to the more-familiar territory of Hermite coefficients, where the data's Gaussian.


## Derivation of the terrific fact

The basis-aligned case where no index can be repeated can be convincingly derived from one general fact about cumulants. This is the wonderful fact that any moment can be built out of a sum of products of cumulants. Recall that

$$
\mathbb{E}\left[X_1 \cdots X_n\right] = \sum_{\pi \in \mathcal{P}(n)} \prod_{B \in \pi} \kappa\left( X_i : i \in B \right),
$$

where the sum is running over all partitions of the $n$ variables and the product is running over the blocks of each partition.[^1]

In our particular case, if there are no repeated indices, we find that $\mathbb{E}\left[z\_{i\_1} \cdots z\_{i\_\ell} \, y\right] = \kappa[z\_{i\_1}, \ldots, z\_{i\_\ell}, y]$, because all partitions except $\pi = [n]$ involve a cumulant of a set of independent Gaussian variables, which is zero. By definition, $\mathbb{E}\left[z\_{i\_1} \cdots z\_{i\_\ell} \, y\right] = c\_\boldsymbol{\alpha}$ where $\alpha$ is the relevant $\ell$-hot vector, and we are done.

The general case is best worked out with generating functions. The cumulant-generating function $K$ here is

$$
K(s, \mathbf{t}) = \log \mathbb{E}\left[e^{s \cdot y + \langle \mathbf{t}, \mathbf{z} \rangle}\right],
$$

with cumulants obtained via differentiation as

$$
\kappa[z_{i_1}, \ldots, z_{i_\ell}, y] = \partial_s \partial_{t_{i_1}} \ldots \partial_{t_{i_\ell}} K(s, \mathbf{t}) |_{s,\mathbf{t} = 0}.
$$

We take the $\partial\_s$ first and find that

$$
\partial_s K(s, \mathbf{t}) |_{s = 0} = \frac{\mathbb{E}\left[y \cdot e^{\langle \mathbf{t}, \mathbf{z} \rangle}\right]}{\mathbb{E}\left[e^{\langle \mathbf{t}, \mathbf{z} \rangle}\right]} = \mathbb{E}\left[y \cdot e^{\langle \mathbf{t} , \mathbf{z} \rangle - \|\mathbf{t}\|^2 / 2}\right].
$$

We now invoke a fortuitous identity:

$$
e^{\langle \mathbf{t} , \mathbf{z} \rangle - \|\mathbf{t}\|^2 / 2} = \sum_\boldsymbol{\alpha} \frac{\mathbf{t}^\boldsymbol{\alpha}}{\sqrt{\boldsymbol{\alpha}!}} h_\boldsymbol{\alpha}(\mathbf{z}),
$$

which comes from Rodrigues definition of the Hermites that $h\_k(x) = \frac{(-1)^{k}}{\sqrt{k!}} \frac{\partial^k \phi(x)}{\phi(x)}$, where $\phi(\cdot)$ is the univariate normal Gaussian density. We thus find that

$$
\partial_s K(s, \mathbf{t}) |_{s = 0} = \mathbb{E}\left[y \cdot \sum_\boldsymbol{\alpha} \frac{\mathbf{t}^\boldsymbol{\alpha}}{\sqrt{\boldsymbol{\alpha}!}} h_\boldsymbol{\alpha}(\mathbf{z})\right].
$$

It is easy now to take derivatives in $\mathbf{t}$, obtaining the desired.


## Closing thoughts

If it isn't clear, I think this is great. I think it'll be useful in the near future. I am a bit bothered that the identity $\kappa[z\_{i\_1}, \ \ldots, \ z\_{i\_\ell}, \ y] = c\_\boldsymbol{\alpha} \cdot \sqrt{\boldsymbol{\alpha}!}$ has this combinatorial factor $\sqrt{\boldsymbol{\alpha}!}$, though. It is one when no indices are repeated and greater than one when some indices recur. This is in line with [some of our recent work](https://arxiv.org/abs/2610.25652) where we found again and again that a Hermite polynomial with repeated indices is learned faster than an otherwise equivalent one without, but by a smaller factor.

I do believe that this factor will probably cancel somehow. If we use *unnormalized* probabilist's Hermites $\text{He}\_\boldsymbol{\alpha}$, then we'd get that $\kappa[z\_{i\_1}, \ \ldots, \ z\_{i\_\ell}, \ y] = \left\langle \text{He}\_\boldsymbol{\alpha}, f \right \rangle$, with no prefactor... but I don't see a justification for thinking in terms of unnormalized Hermites. I instead suspect that the cancellation will come from permutation symmetries in the cumulant: if you sum over all distinct permutations of the indices $(i\_j),$ you find a total power (i.e. squared coefficient) of

$$
\sum_{\sigma \in S(\mathbf{i})} \kappa[z_{i_{\sigma(1)}}, \ \ldots, \ z_{i_{\sigma(\ell)}}, \ y]^2 = | S(\mathbf{i}) | \times \kappa[z_{i_{1}}, \ \ldots, \ z_{i_{\ell}}, \ y]^2 = c_\boldsymbol{\alpha}^2 \cdot \ell!,
$$

with the same combinatorial factor $\ell!$ for all Hermites of a given order. Because there's no reason to prefer any particular ordering, this operation seems likely to show up and give us the desired cancellation.

***

[^1]: If you ask me, this formula is the main fact to know about cumulants. It states that they're building blocks of moments. Note that Wick's Theorem is a direct consequence. This all comes from the $\exp$ and $\log$ in the cumulant-generating function, and emerges from a beautiful intersection between calculus and discrete math with which one can spend a few days in reverie.
