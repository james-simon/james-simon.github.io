---
layout: post
title: "Using the Laplacian to take a local average of a function"
date: 2024-06-06
category: mathematics
emoji: ∇
---

The Laplacian operator in $d$ dimensions is defined as $\nabla^2 \equiv \sum_{i=1}^d \frac{\partial^2}{\partial x_i^2}$. It’s widely used to model diffusion processes in physics — for example, the [heat equation](https://en.wikipedia.org/wiki/Heat_equation), which describes the diffusion of heat through a material, is given by $\frac{\partial f(\mathbf{x},t)}{\partial t} = \nabla^2 f(\mathbf{x}, t)$. This operator’s come up in [my recent thinking about the 1NN algorithm]({{site.baseurl}}/blog/1nn-eigenframework): in particular, I’ve been trying to write down a linear operator that replaces a function with its local average, and I had a sense that you could probably do this with the Laplacian somehow. In thinking this through, I encountered something neat I hadn’t appreciated before: for any analytic function $f$, it holds that

<div style="text-align: center;">
<div style="border: 1px solid black; padding: 10px; display: inline-block;">
$$
\left( e^{\frac{\sigma^2}{2} \nabla^2} f \right)(\mathbf x) = \mathbb{E}_{\mathbf{\boldsymbol{\delta}} \sim \mathcal{N}(0, \sigma^2 \mathbf{I}_d)}[f(\mathbf{x} + \boldsymbol{\delta})].
$$
</div>
</div>

That is, the (exponentiated) Laplacian of a function (LHS) is equal to its local average w.r.t. a Gaussian measure (RHS). The RHS is nonlocal, but the LHS is entirely local, so this has some spooky-action-at-a-distance vibes.

Why is this the case? I’ll give two explanations in 1D, and it’ll be relatively clear how to extend it to higher dimension.

## Argument from discretization of space

The Laplacian can be understood intuitively as the limit of its definition on a discretized lattice as the lattice spacing goes to zero. Suppose that instead of a function over the reals, the function $f$ only takes values on the points $\epsilon \mathbb{Z}$ — that is, $\{\ldots, -2\epsilon, -\epsilon, 0, \epsilon, 2\epsilon, \ldots \}$ — for some small value of $\epsilon$. We could represent the *derivative* of $f$ as

$$
(Df)(x) = \frac{f(x + \epsilon) - f(x)}{\epsilon},
$$

where $x \in \epsilon \mathbb{Z}$. Similarly, we can define the Laplacian as

$$
\left( \nabla^2 f \right)(x) = \frac{f(x - \epsilon) - 2 f(x) + f(x + \epsilon)}{\epsilon^2}.
$$

If we add the identity to the Laplacian operator, we see that

$$
\left( \left[1 + \frac{\epsilon^2}{4} \nabla^2 \right] f \right)(x) = \frac{f(x - \epsilon) + 2 f(x) + f(x + \epsilon)}{4}.
$$

(The choice of $\frac{1}{4}$ as the prefactor here is arbitrary, but will make things simpler.) We see then that the operator $1 + \frac{\epsilon^2}{4} \nabla^2$ takes a weighted average of the function value at a point and its two neighbors (with weights $\frac 14, \frac 12, \frac 14$ respectively).

We can see this as a single step of a random walk. Taking a dual view where instead of staying fixed at the point $x$, we follow the diffusion of the function mass that *started* at $x$, we see that $\frac 14$ of the mass has gone one point to the left, $\frac 12$ of the mass has remained in place, and $\frac 14$ of the mass has moved one point to the right.

After many steps, a random walk on an infinite lattice approaches a (discretized) Gaussian distribution by the central limit theorem. In particular, if we take $n \gg 1$ steps, the corresponding Gaussian will have a variance of $\frac {\epsilon^2 n}{2}$. If we choose $n = \frac{2 \sigma^2}{\epsilon^2}$, we get a Gaussian with variance $\sigma^2$, which gives us the RHS of the boxed equation above!

As for the LHS, since we’ve iterated this operator $n$ times, it corresponds to

$$
\left[1 + \frac{\epsilon^2}{4} \nabla^2 \right]^n = \left[1 + \frac{\epsilon^2}{4} \nabla^2 \right]^{\frac{2 \sigma^2}{\epsilon^2}}
\xrightarrow{\epsilon \rightarrow 0}
e^{\frac {\sigma^2} 2 \nabla^2}.
$$

Great! Let’s test this conclusion on the eigenfunctions of the Laplacian. Let $f_k(x) = e^{i k x}$. Then

$$
e^{\frac {\sigma^2} 2 \nabla^2} f_k = e^{- \frac {\sigma^2 k^2} 2} f_k
$$

and also, using the standard Gaussian integral, we find that

$$
\mathbb{E}_{\delta \sim \mathcal{N}(0, \sigma^2)}[f_k(x + \delta)] = e^{- \frac {\sigma^2 k^2} 2} f_k.
$$

Great! Actually, since the boxed relation holds for the complete Fourier basis, it’ll hold for all functions (or at least all functions that equal their Fourier series).

## Argument from Taylor series

Consider the function $f(x) = x^a$ for some $a \in \mathbb{Z}^+$. A standard Gaussian integral yields that

$$
\mathbb{E}_{\delta \sim \mathcal{N}(0,\sigma^2)}[\delta^a] =
\left\{\begin{array}{ll}        \frac{a!}{2^{a/2} (a/2)!} \sigma^a & \text{for } a \text{ even}, \\        0 & \text{for } a \text{ odd}.        \end{array}\right.
$$

Similarly, the LHS of the boxed equation gives the same result — this is easiest to show starting by writing out

$$
e^{\frac{\sigma^2}{2} \nabla^2} = \lim_{n \rightarrow \infty} \left[1 + \frac{\sigma^2}{2n} \nabla^2 f \right]^n
$$

and then expanding the right hand side. Anyways, the fact that the boxed equation holds for any monomial around zero is sufficient to argue that any function that converges to its Taylor series (that is, any analytic function) satisfies the boxed equation. Neat!

As a closing thought, there's a potential paradox raised by the boxed equation, which is: how can you take a *nonlocal* average of a function with the Laplacian, which is a local operator?
The answer is that the exponentiation actually means that we're applying the Laplacian an infinite number of times -- it's rather believable that this counteracts the locality of the operator, especially in light of our discretized model.

Actually, one more closing thought: so the boxed equation tells us how to study the local *Gaussian* average... what if we wanted, say, the local *Laplacian* average, or some other rotation-invariant distribution?
Well, you could just represent that distribution in the basis of Gaussians of different widths, and then you've got it -- you'll just have some sum or integral over different values of $$\sigma^2$$ on the LHS of the boxed equation.
That seems useful in some cases -- for example, I actually needed a Laplacian average for the aforementioned 1NN analysis.





