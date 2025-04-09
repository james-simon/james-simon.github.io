---
layout: post
title: "One kernel, many eigensystems"
date: 2025-04-07
category: deep learning, research
---

*This is a technical note on a subtlety of kernel theory. Venture in at your own risk!*

***

Many problems in the theory of kernel methods begin with a positive semi-definite kernel function $K(\cdot, \cdot)$ and a probability measure $\mu$ and are solved by first finding the kernel eigenfunctions $\{\phi\_i\}$ and nonnegative eigenvalues $\{\lambda\_i\}$ such that

$$
\ \ \ \qquad\qquad \qquad\qquad K(x,x') = \sum_i \lambda_i \, \phi_i(x) \, \phi_i(x') \qquad\qquad \qquad\qquad (1)
$$

and

$$
\qquad\qquad \qquad\qquad\quad \ \ \ \mathbb{E}_{x \sim \mu}[\phi_i(x) \, \phi_j(x')] = \delta_{ij}. \qquad\qquad \qquad\qquad\quad (2)
$$

Equation 1 gives the spectral decomposition of the kernel, and Equation 2 states that the eigenfunctions are orthonormal with respect to the measure $\mu$.[^1]

[^1]: Astute readers might wonder why we do not also need to take as input the ”eigenequation” that $\mathbb{E}\_{x \sim \mu}[K(x, x') \, \phi\_j(x')] = \lambda\_i \, \phi\_i(x).$ Somewhat surprisingly (to me), this can actually be deduced from Equations 1 and 2, as we will discuss after vectorizing.

By [Mercer’s Theorem](https://en.wikipedia.org/wiki/Mercer%27s_theorem), there always exists such a decomposition, though it will generally be different for different measures $\mu$. In fact, there are infinitely many unique decompositions of the form $K(x,x') = \sum\_i \psi\_i(x) \, \psi\_i(x')$, but only one of them (up to relabeling and some other symmetries) is “eigen” for a particular measure $\mu$. It is somewhat intriguing to note that each such decomposition is still equally *correct* no matter the measure (the first equation having no dependence on $\mu$).

Given that every measure $\mu$ corresponds to a unique eigendecomposition, it is worth asking the inverse question: which kernel decompositions are “eigen” for some measure? That is, given a “candidate” eigensystem $\{(\lambda\_i, \phi\_i)\}$ such that $K(x,x') = \sum\_i \lambda\_i \, \phi\_i(x) \, \phi\_i(x')$, when does there exist a measure $\mu$ such that $\mathbb{E}\_{x \sim \mu}[\phi\_i(x) \, \phi\_j(x')] = \delta\_{ij}$, and can we find the measure?

## Functional $\rightarrow$ vector language

To answer this question, we will find it helpful to first move from a continuous setting to a discrete setting, as we may then forgo functional analysis for the simpler language of linear algebra. Let us suppose our measure has support only over $n$ discrete points $\{x\_i\}\_{i=1}^n$, and let us construct the kernel matrix $[\mathbf{K}]\_{ij} = K(x\_i, x\_j)$, measure matrix $\mathbf{M} = \mathrm{diag}(\mu(x\_1), \ldots, \mu(x\_n))$, and candidate eigenvectors $\mathbf{v}\_i = (\phi\_i(x\_1), \ldots, \phi\_i(x\_n))$. In this linear algebraic language, we begin with the assurance that

$$
\mathbf{K} = \sum_i \lambda_i \mathbf{v}_i \mathbf{v}_i^\top.
$$

We would like to determine necessary and sufficient conditions on $\{\lambda\_i, \mathbf{v}\_i\}$ such that there exists a positive-definite[^4] diagonal $\mathbf{M}$ such that

[^4]: Since we have assumed that all eigenvalues are nonnegative, we can conclude that $\mathbf{M}$ will be positive *definite* instead of merely PSD.

$$
\mathbf{v}_i^{\top} \mathbf{M} \mathbf{v}_j = \delta_{ij}
$$

and $\mathrm{Tr}[\mathbf{M}] = 1$.
We begin by stacking our candidate vectors into a matrix $\mathbf{V} := (\mathbf{v}\_1, \ldots, \mathbf{v}\_n)$ and likewise defining $\boldsymbol{\Lambda} := \mathrm{diag}(\lambda\_1, \ldots, \lambda\_n)$. Note that all the matrices we have defined are invertible. We now have that

$$
\mathbf{K} = \mathbf{V \Lambda V^\top}, \qquad \mathbf{V^\top M V} = \mathbf{I}.
$$

From the latter equation, we get that $\mathbf{M V V^\top} = \mathbf{I}$, and thus $\mathbf{K M V V^\top} = \mathbf{V \Lambda V^\top}$, and thus we obtain the eigenequation[^2]

[^2]: This manipulation answers the question raised by Footnote 1: even with a nontrivial measure, the “right eigenequation” follows from the “kernel-compositional” and “measure-orthogonal” equations. We can in fact obtain any one of these equations from the other two.

$$
\mathbf{K M V} = \mathbf{V \Lambda}.
$$

We now find that $\mathbf{M V} = \mathbf{K}^{-1}\mathbf{V \Lambda}$, and thus that $\mathbf{M v}\_i = \lambda\_i \mathbf{K}^{-1} \mathbf{v}\_i$ for each eigenindex $i$. We are now in a position to make several observations.

First, since $\mathbf{v}^\top\_i \mathbf{M v}\_j = \lambda\_i \mathbf{v}^\top\_i \mathbf{K}^{-1} \mathbf{v}\_j = \delta\_{ij}$, we find the requirement on our candidate eigensystem that $\lambda\_i = \left( \mathbf{v}^\top\_i \mathbf{K}^{-1} \mathbf{v}\_i \right)^{-1}$. This is best viewed as a normalization condition on the eigenvector: it is required that

$$
\boxed{

|\!| \mathbf{v}_i |\!| = \left( \lambda_i \hat{\mathbf{v}}_i^\top \mathbf{K}^{-1} \hat{\mathbf{v}}_i  \right)^{-1/2}

}.
$$

Second, since $\mathbf{M}$ is positive and diagonal, we find that

$$
\mathbf{M v}_i = \mathbf{\mu} \circ \mathbf{v}_i = \lambda_i \mathbf{K}^{-1} \mathbf{v}_i
$$

where $\circ$ denotes elementwise multiplication of vectors. Therefore a single candidate eigenpair $(\lambda\_1, \mathbf{v}\_1)$ is potentially valid only if there exists a positive vector $\mathbf{\mu}$ verifying the above equation — that is, if

$$
\boxed{
m_{ik} := \frac{\lambda_i (\mathbf{K}^{-1} \mathbf{v}_i)[k]}{\mathbf{v}_i[k]} > 0
\qquad \text{if} \ \  \mathbf{v}_i[k] \neq 0,}
$$

where we write $\mathbf{u}[k]$ denote the $k$-th element of a vector. We must additionally have that the different eigenvectors verify the same measure — that is,

$$
\boxed{
m_{ik} = m_{ik'} := \mu_i
\qquad
\forall
\ \
k, k'
}
$$

except where one of the two is undefined, and of course that the measure is normalized:

$$
\boxed{
\sum_i
\mu_i = 1.
}
$$

Together, the boxed equations are necessary and sufficient conditions for the existence of a positive measure $\mathbf{\mu}$ such that $\{(\lambda\_i, \mathbf{v}\_i)\}$ indeed comprise an orthogonal eigenbasis with respect to $\mathbf{\mu}$. Interestingly, it follows from the above with no additional requirements that

$$
\mathbf{v}_i^\top \mathbf{K}^{-1} \mathbf{v}_j = 0 \qquad \mathrm{if} \ i \neq j.
$$

That is, orthogonality with respect to the measure implies orthogonality with respect to $\mathbf{K}^{-1}$.

## Back to functional language

To phrase these results in functional language, we need to define the *inverse kernel operator.* Define the kernel operator $T\_K\[g\](\cdot) = \int K(\cdot, x) g(x) dx$. Let us assume this operator is invertible and construct the inverse $T^{-1}\_K$.[^3] In functional language, we require that

[^3]: To gain some intuition for these operators, note that if $K(\cdot, \cdot)$ is a Gaussian kernel, then $T\_K$ performs Gaussian smoothing, while $T\_K^{-1}$ performs “unsmoothing.”

$$
\frac{\lambda_i \, T_K^{-1} [\phi_i](x)}{\phi_i(x)} = \frac{\lambda_j \, T_K^{-1} [\phi_j](x)}{\phi_j(x)} > 0
\qquad \forall \ i, j, x,
$$

except when either ratio is $\frac{0}{0}$. When this condition holds, the equated quantity is then equal to the measure $\mu(x)$ w.r.t. which $\{\phi_i\}$ are orthogonal.
Again, a single candidate eigenfunction $\phi_i$ determines the whole measure $\mu$ except where $\phi_i(x) = 0$.
We also of course require that the measure we find from the above is normalized when integrated over the full domain.

We also find the (somewhat more inscrutable to me) condition that

$$
\lambda_i = \left(\int \phi_i(x) \, T_K^{-1} [\phi_i](x) dx\right)^{-1},
$$

which again may be treated as a normalization condition on the eigenfunctions $$\phi_i$$.

## Connection to RKHS inner product

The usual reproducing kernel Hilbert space (RKHS) inner product is given by

$$
\langle g, h \rangle_K := \int g(x) \, T_K^{-1}[h](x) dx.
$$

In our vectorized setting we found that $\mathbf{v}\_i^\top \mathbf{K}^{-1} \mathbf{v}\_j = 0$ when $i \neq j$, and so we find in the functional setting that *for any kernel eigenfunctions w.r.t. any measure, it will hold that* $\langle \phi\_i, \phi\_j \rangle\_K = 0$ when $i \neq j$. That is, no matter which measure you choose, the eigenfunctions which diagonalize the kernel operator will be orthogonal w.r.t. the RKHS. This is remarkable because the RKHS norm does not depend at all on the measure which was chosen! I tend to avoid using RKHSs whenever possible, but this is a nice property.


***
*Thanks to Dhruva Karkada for raising the question that led to this blogpost.*

***
