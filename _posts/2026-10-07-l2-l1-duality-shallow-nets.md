---
layout: post
title: "A note on $L^2 \\leftrightarrow L^1$ duality in shallow homogeneous nets"
tab_title: "A note on L2-L1 duality in shallow homogeneous nets"
date: 2026-10-07 09:00:00
category: dl-science
emoji: 👬
---

If you've been around the deep learning theory block long enough to get to know the locals, you've probably heard something like this at some point:

> *In a shallow homogeneous neural net, minimizing the $L^2$-norm of the parameters is equivalent to minimizing the $L^1$-norm of a measure over unit-norm neurons.*

This makes a link between "aggregate $L^2$ land" and "sparse $L^1$ land." It's also directly relevant to SAEs, which are pretty much shallow homogeneous nets, and it's the first place you should start when trying to understand why they tend towards sparsity. (As far as I know, incredibly, this project has not yet been done. @The entire field of mechinterp.)

...anyways, Dhruva brought this up recently and asked me to write something explaining the idea. I've explained this a few times to different people, but I don't actually know a good beginner ref for it, so I said yes.

## Matrix factorization to get the main idea

To get the idea, let's start with a general matrix factorization problem. Let $\mathbf{A} \in \mathbb{R}^{m \times h}$ and $\mathbf{B} \in \mathbb{R}^{n \times h}$ be the two factors of a matrix $\mathbf{F} = \mathbf{AB}^\top$.[^1] Suppose we want to minimize some loss $\mathcal{L}(\mathbf{F})$, which might for example be the distance between $\mathbf{F}$ and some target matrix. Let's also toss in an $L^2$ parameter norm penalty with coefficient $\lambda$. We've got the following optimization problem on our hands:

$$
\min_{\mathbf{A},\mathbf{B}}
\left[
\mathcal{L}(\mathbf{A B}^\top) + \frac{\lambda}{2}
\left(
\| \mathbf{A} \|_\text{F}^2 + \|\mathbf{B}\|_\text{F}^2
\right)
\right].
$$

(Note that I should really be saying $\operatorname{argmin}$ instead of $\min$ here, since we're interested in the values of $\mathbf{A}, \mathbf{B}$ more than the value of the objective. As is common, we'll just abuse notation a bit and leave it as understood that, when we describe an optimization process, we're interested in both minimum and minimizer.)

Let's let $\mathcal{F}$ be the set of realizable values for $\mathbf{F}$ under this parameterization. That is, it's the set of all $\mathbf{F} \in \mathbb{R}^{m \times n}$ such that $\text{rank}(\mathbf{F}) \le h$. We can rewrite our optimization problem in the following "inner-outer" form:

$$
\underbrace{
\min_{\mathbf{F} \in \mathcal{F}} \mathcal{L}(\mathbf{F})
}_{\text{outer opt. over }\mathbf{F}}
\quad + \quad
\frac{\lambda}{2} \cdot 
\underbrace{
\min_{\mathbf{A},\mathbf{B}}
\left[
\| \mathbf{A} \|_\text{F}^2 + \|\mathbf{B}\|_\text{F}^2
\right]
\ \
\text{s.t.}
\ \
\mathbf{A} \mathbf{B}^\top = \mathbf{F}.
}_{\text{inner opt. over }\mathbf{A},\mathbf{B}\text{ given }\mathbf{F}}
$$

The outer objective is not exactly minimized, since $\mathbf{F}$ appears in the inner term, too. However, the inner objective is always minimized --- whatever $\mathbf{F}$ ends up being, we're sure as heck gonna realize it the most efficient way possible, because why wouldn't we? It's free points.

Anyways, the story at hand is about this inner loop and some easy ways we can win free points. First, let's write out

$$
\mathbf{F} = \sum_{i=1}^h \mathbf{a}_i \mathbf{b}_i^\top,
$$

where $\mathbf{a}_i, \mathbf{b}_i$ are the $i$-th rows of $\mathbf{A}, \mathbf{B}$. First key observation: if $\\|\mathbf{a}_i\\| \neq \\|\mathbf{b}_i \\|$, then we can get free points by rescaling like

$$
\mathbf{a}_i \rightarrow \mathbf{a}_i \ \cdot \ \sqrt{\frac{\| \mathbf{b}_i \|}{\| \mathbf{a}_i \|}}, \qquad \mathbf{b}_i \rightarrow \mathbf{b}_i \ \cdot \ \sqrt{\frac{\| \mathbf{a}_i \|}{\| \mathbf{b}_i \|}}.
$$

We can thus be assured that, at optimum, $\\|\mathbf{a}_i\\| =\\|\mathbf{b}_i \\|$. Let's reparameterize to separate the norm and unit-vector degrees of freedom:

$$
s_i := \| \mathbf{a}_i \|^2, \quad 
\hat{\mathbf{a}}_i = \text{unit}(\mathbf{a}_i), \quad
\hat{\mathbf{b}}_i = \text{unit}(\mathbf{b}_i).
$$

Let's also let $\hat{\mathbf{M}}_i := \hat{\mathbf{a}}_i \hat{\mathbf{b}}_i^\top$ be the rank-one, unit-norm matrix built from $\hat{\mathbf{a}}_i, \hat{\mathbf{b}}_i$. We can now rewrite the inner-loop optimization:

$$
\min_{(s_i, \hat{\mathbf{M}}_i)_{i=1}^h} \sum_{i=1}^h s_i
\quad \text{s.t.} \quad
s_i \ge 0 \ \ \text{and} \ \
\mathbf{F} = \sum_{i=1}^h s_i \hat{\mathbf{M}}_i.
$$

Note that now *nothing is squared in the optimization objective.* Things are starting to look $L^1$. Actually, we can relax the problem to allow $s_i <0$ and get this equivalent problem:

$$
\min_{(s_i, \hat{\mathbf{M}}_i)_{i=1}^h} \sum_{i=1}^h |s_i|
\quad \text{s.t.} \quad
\mathbf{F} = \sum_{i=1}^h s_i \hat{\mathbf{M}}_i.
$$

That's explicitly an $L^1$ objective on the weights $s_i$. To summarize the point here: penalizing the $L^2$-norm of two factors was equivalent to penalizing the $L^1$ norm of their product.

For good measure (ha), we can move to measure-theoretic language by taking $h \rightarrow \infty$. I'm not going to attempt to be rigorous here; I just want to point out that the inner optimization takes on the continuum formulation

$$
\min_{\mu} \int_\mathcal{M} |d \mu|
\qquad \text{s.t.} \qquad
\int_\mathcal{M} \hat{\mathbf{M}} \ d \mu = \mathbf{F},
$$

where $\mathcal{M}$ is the set of rank-one unit-norm matrices, and $\mu$ is a measure over that set (that need be neither nonnegative nor integrate to one!). At finite $h$, this formulation is still valid, but $\mu$ is just constrained to be a sum of at most $h$ atoms.

(Before moving on: the point is the *form* of the inner-loop optimization, not the solution, since after all we're now going to go on to ReLU nets, for which there won't be a closed-form solution. But since it exists, and curious minds might inquire, I'll note that in this mfac case the solution to the inner loop is to have $\mu$ be a sum of $\text{rank}(\mathbf{F})$ atoms, one for each SVD term of $\mathbf{F}$.)

## $L^1$ sparsity in ReLU nets

Let's set up a problem involving ReLU nets now. Again let $\mathbf{A} \in \mathbb{R}^{m \times h}$ and $\mathbf{B} \in \mathbb{R}^{n \times h}$, and let

$$
{f}_{(\mathbf{A},\mathbf{B})}: \mathbf{x} \mapsto \mathbf{B} \ \text{ReLU}(\mathbf{A^\top x})
$$

be the (vector-valued) function at hand. Our optimization problem now takes the form

$$
\min_{\mathbf{A},\mathbf{B}}
\left[
\mathcal{L}(f_{(\mathbf{A},\mathbf{B})}) + \frac{\lambda}{2}
\left(
\| \mathbf{A} \|_\text{F}^2 + \|\mathbf{B}\|_\text{F}^2
\right)
\right].
$$

This again admits the inner-outer form

$$
\underbrace{
\min_{f \in \mathcal{F}} \mathcal{L}(f)
}_{\text{outer opt. over }f}
\quad + \quad
\frac{\lambda}{2} \cdot 
\underbrace{
\min_{\mathbf{A},\mathbf{B}}
\left[
\| \mathbf{A} \|_\text{F}^2 + \|\mathbf{B}\|_\text{F}^2
\right]
\ \
\text{s.t.}
\ \
f_{(\mathbf{A},\mathbf{B})} = f
}_{\text{inner opt. over }\mathbf{A},\mathbf{B}\text{ given }f}
$$

for suitable $\mathcal{F}$. We have neuronwise rescaling symmetry between weight matrix rows $(\mathbf{a}_i, \mathbf{b}_i)$, and we can invoke the same tricks as before. We just need some language to describe single-neuron functions, which are the generalization of rank-one matrices. Let $\hat{g}\_{\hat{\mathbf{a}}, \hat{\mathbf{b}}} : \mathbf{x} \mapsto \hat{\mathbf{b}} \ \text{ReLU}(\hat{\mathbf{a}}^\top \mathbf{x})$ be a single-neuron function with unit vector inputs and outputs, and let

$$
\mathcal{G} = \left\{\hat{g}_{(\hat{\mathbf{a}},\hat{\mathbf{b}})}  \ \ \ \forall \ \ \ \hat{\mathbf{a}} \in \mathbb{S}^m, \hat{\mathbf{b}} \in \mathbb{S}^n \right\}.
$$

The inner loop of the optimization takes the form

$$
\min_{\mu} \int_\mathcal{G} |d \mu|
\qquad \text{s.t.} \qquad
\int_\mathcal{G} \hat{g} \ d \mu = f,
$$

where $\mu$ is a (neither nonnegative nor normalized) measure over $\mathcal{G}$. This is the "ta-dah" moment: we've transformed a problem with no $L^1$ in it at all into one with an explicit $L^1$ norm objective.

If you doubt that the final here should really be thought of as $L^1$, then you could instead fix $\mu_{\text{unif}}$ to be the uniform measure over $\mathcal{G}$ and instead optimize over a "weight function" $w$ like

$$
\min_{w} \int_\mathcal{G} |w| \cdot  d \mu_\text{unif}
\qquad \text{s.t.} \qquad
\int_\mathcal{G} \hat{g} \cdot w \cdot d \mu_\text{unif} = f.
$$

My various abuses of notation are catching up to me, though, so I'll stop here.

***

*Thanks to Arthur Jacot for teaching me this back in the day.*

***

[^1]: If the derivation below loses you, I suggest you work it through in a scalar case with $m = n = h = 1$.
