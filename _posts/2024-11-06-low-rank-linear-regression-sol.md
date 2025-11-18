---
layout: post
title: "The optimal low-rank solution for multivariate linear regression"
date: 2024-11-06
category: kernels
emoji: 👌
---

Consider linear regression with squared error in which we wish to choose a matrix $\mathbf{W}$ to minimize

$$
\mathcal{E} \equiv \mathbb{E}_{(x, y) \sim \mu}\left[ |\!| \mathbf{W}x - y |\!|^2 \right] = \text{Tr}\left[ \mathbf{W} \boldsymbol{\Sigma}_{xx} \mathbf{W}^T - 2 \mathbf{W} \boldsymbol{\Sigma}_{xy} + \boldsymbol{\Sigma_{yy}} \right],
$$

where $\boldsymbol{\Sigma}\_{xx} = \mathbb{E}[x x^T]$ and so on, under the constraint that $\mathbf{W}$ may be at most rank $k$. Assume that $\boldsymbol{\Sigma}\_{xx}$ is full rank (i.e., we are underparameterized). We may rewrite this loss as

$$
\mathcal{E} = |\!| \tilde{\mathbf{W}} - \boldsymbol{\Sigma}_{yx} \boldsymbol{\Sigma}_{xx}^{-1/2} |\!|_F^2,
$$

where $\tilde{\mathbf{W}} \equiv \mathbf{W} \boldsymbol{\Sigma}^{1/2}$. It is then clear that the optimal rank-$k$ choice for $\tilde{\mathbf{W}}$ is

$$
\tilde{\mathbf{W}}_*^{(k)} = \text{topsvd}_k(\boldsymbol{\Sigma}_{yx} \boldsymbol{\Sigma}_{xx}^{-1/2} ),
$$

where the operator $\text{topsvd}_k(\cdot)$ returns the matrix comprised of the top $k$ singular directions of its argument. We thus conclude that the optimal rank-$k$ model matrix is

$$
\mathbf{W}_*^{(k)} = \text{topsvd}_k(\boldsymbol{\Sigma}_{yx} \boldsymbol{\Sigma}_{xx}^{-1/2} ) \boldsymbol{\Sigma_{xx}}^{-1/2}.
$$

When the rank is unconstrained and $k$ is maximal, we find that $\mathbf{W}\_* = \boldsymbol{\Sigma}\_{yx} \boldsymbol{\Sigma}\_{xx}^{-1}$ as expected.

