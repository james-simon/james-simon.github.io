---
layout: post
title: "Towards first-principles architecture design by reverse engineering the NTK"
date: 2022-08-23
category: deep learning, research
---

<p style="text-align:center;">
<img src="{{site.imgurl}}/rev_eng_banner.png" width="40%">
</p>
<p style="margin-left:20%; margin-right:20%;">
<small>
<i> banner figure that'll appear on the main page of the site </i>
</small>
</p>

Deep neural networks have enabled technological wonders ranging from voice recognition to machine transition to protein engineering, but their design and application is nonetheless notorious unprincipled.
Consider how *any other field of engineering* operates: we start with a description of a problem, procedurally design a structure or system well-suited to solve it, and build it.
We normally find that our system behaves close to how we predicted, and if it doesn’t, we can understand its failings.
Deep learning, by contrast, is basically [alchemy](https://www.youtube.com/watch?v=x7psGHgatGM): while we’ve made amazing progress with intuition and trial and error, practitioners have almost no principled methods for neural architecture design, and SOTA systems are often full of hacks and hyperparameters we might not need if we understood what we were doing.
As a result, the development of new methods is often slow and expensive, and even when we find clever new ideas, we often don't understand why they work as well as they do.

In [Reverse Engineering the Neural Tangent Kernel](https://arxiv.org/abs/2106.03186), work with Sajant Anand and Mike DeWeese, we propose a way of thinking that we find promising for bringing some principle to the art of architecture design.
The field of deep learning theory has recently been transformed by the realization that deep neural networks often become tractable to study in the *infinite-width* limit.
Take the limit a certain way, and the network in fact converges to ordinary *kernel regression*[^1] using either the architecture's ["neural tangent kernel" (NTK)](https://arxiv.org/abs/1806.07572) or, if only the last layer is trained (a la random feature models), its ["neural network Gaussian process" (NNGP) kernel](https://arxiv.org/abs/1711.00165).
Like the central limit theorem, the NTK limit is a good approximation even far from infinite width (often holding true at widths in the hundreds or thousands), giving a remarkable analytical handle on the mysteries of deep learning.

The original works exploring this net-kernel correspondence gave formulae for going from *architecture* to *kernel*: given a description of an architecture (e.g. depth and activation function), they give you the network's NTK.
This has allowed great insights into the optimization and generalization of various architectures of interest.
However, if our goal is not merely to understand existing architectures but to design *new* ones, then we might rather have the mapping in the reverse direction: given a *kernel* we want, can we find an *architecture* that gives it to us?
In this work, we derive this inverse mapping for fully-connected networks (FCNs), allowing us to design simple nets in a principled manner by (a) positing a desired kernel and (b) designing an activation function that gives it.

To get a feel for how this works, let's first visualize some neural network kernels.
Consider a wide FCN's NTK $K(x_1,x_2)$ on two input vectors $x_1$ and $x_2$ (which we will for simplicity assume are normalized to the same length).
For a FCN, this kernel is *rotation-invariant* in the sense that $K(x_1,x_2) = K(c)$, where $c$ is the cosine of the angle between the inputs.
This means we can just plot the kernel function.
Fig. 1 shows the NTK of a four-hidden-layer (4HL) ReLU FCN.

<p style="text-align:center;">
<img src="{{site.imgurl}}/rev_eng_fig1.png" width="40%">
</p>
<p style="margin-left:20%; margin-right:20%;">
<small>
<i> <b>Fig 1.</b> NTK for a 4HL ReLU FCN as a function of the cosine between two input vectors $x_1$ and $x_2$. </i>
</small>
</p>

There's actually quite a lot one can learn from this plot.
The monotonic increase means that this kernel expects closer points to have more correlated function values.
The steep increase at the end tells us that the correlation length is not too large, and it can fit complicated functions.
The diverging derivative at $c=1$ tells us about the smoothness of the function we expect to get.
However, *none of these are apparent* from looking at a plot of $\textrm{ReLU}(z)$.
If we want to understand the effect of a choice of activation function $\phi$, then its resulting NTK is actually more informative than $\phi$ itself!
It thus perhaps makes sense to try to design architectures "in kernel space," then translate them to the typical hyperparameters.

Our paper's main result is a "reverse engineering theorem" that states the following:

*For any kernel $K(c)$, we can construct an activation function $\phi$ such that, when inserted into a **single-hidden-layer** FCN, it yields $K(c)$ as its NTK.*

We give an explicit formula for $\phi$ in terms of Hermite polynomials.
(In practice, however, Hermite polynomial nets aren't easy to train, so we use a different functional form with the help of some numerics.)
Our proposed use of this idea is that, in problems with some known structure, it'll sometimes be possible to write down a good kernel and reverse-engineer it into a trainable network with various advantages over kernel regression.
As a proof of concept, we test this idea out on the synthetic *parity problem* (i.e., given a bitstring, is the sum odd or even?), designing a FCN that dramatically outperforms a $\text{ReLU}$ network.

Here's another fun use of this theorem.
The kernel curve above is for a 4HL ReLU FCN, but I claimed that we can achieve any kernel, including that one, with just one hidden layer.
This implies we can come up with some new activation function $\tilde{\phi}$ that gives the same kernel *in a shallow network*!

<p style="text-align:center;">
<img src="{{site.imgurl}}/rev_eng_fig2.png" width="50%">
</p>
<p style="margin-left:20%; margin-right:20%;">
<small>
<i> <b>Fig 2.</b> Shallowification of a deep ReLU FCN into a 1HL FCN with an engineered activation function. </i>
</small>
</p>

Surprisingly, this "shallowfication" actually works.
The left plot below shows a "mimic net" activation function $\tilde{\phi}$ that gives the same NTK as a deep ReLU FCN.
The right plots then show train + test loss + accuracy traces for three FCNs on a standard tabular problem from the UCI dataset.
Note that, while the shallow and deep ReLU nets have very different behaviors, our engineered shallow mimic net tracks the deep network almost exactly!

<p style="text-align:center;">
<img src="{{site.imgurl}}/rev_eng_fig3.png" width="70%">
</p>
<p style="margin-left:20%; margin-right:20%;">
<small>
<i> <b>Fig 3.</b> Left panel: engineered "mimic" activation function $\tilde{\phi}$, plotted with ReLU for comparison. Right panels: performance traces for 1HL ReLU, 4HL ReLU, and 1HL mimic FCNs trained on a UCI dataset. Note the close match between the 4HL ReLU net and the 1HL mimic net. </i>
</small>
</p>

This is interesting from an engineering perspective because the shallow net uses fewer parameters than the deep network to achieve the same performance.
It's also interesting from a theoretical perspective because it raises fundamental questions about the value of depth.
A common belief deep learning belief is that deeper is not only better but *qualitatively different*: that deep networks will efficiently learn functions that shallow networks simply cannot.
This result strongly suggests that, at least for FCNs, this isn't true: if we know what we're doing, then depth doesn't buy us anything[^2].

This work comes with lots of caveats.
The biggest is that our result only applies to FCNs, which alone are rarely state-of-the-art.
However, work on convolutional NTKs is [fast progressing](https://arxiv.org/abs/2112.05611), and we believe this paradigm of designing networks by designing kernels holds promise for useful application.

Theoretical work has so far furnished relatively few tools for practical deep learning theorists.
We aim for this to be a modest step in that direction.
Even without a science to guide their design, neural networks have already enabled wonders.
Just imagine what we'll be able to do with them once we finally have one.


[^1]: In case you're unfamiliar with kernels or kernel regression, a kernel is basically a similarity function between two samples generalizing the dot product, and kernel regression is just linear regression with the dot product replaced by the kernel function.

[^2]: (It's the belief of this author that deeper really is different for CNNs, and so studies aiming to understand the benefits of depth for generalization should focus on CNNs and other structured architectures.)