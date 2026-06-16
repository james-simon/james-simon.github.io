---
layout: post
title: "Higher derivatives of an inverse function"
date: 2026-06-16 07:00:00
category: mathematics
emoji: 🙃
---

I learned something beautiful today and just wanted to share it. Obviously, this blog is super eclectic, with tons of posts on science and math and art and life, with no particular order. Maybe someday I'll organize it.

This a pretty basic calculus trick. In fact, I wouldn't be surprised if I'd come across it in high school and just forgot it. But today it came up in my research, and I had to rederive it, and I thought it was very pretty.

So say you have a scalar function $s(t)$, which we'll assume to be differentiable and generally cooperative. You can go ahead and find its derivatives $\frac{d s}{d t}, \frac{d^2 s}{d t^2}, \frac{d^3 s}{d t^3}$, and so on. But suppose that (like I did) for some problem at hand, you need the derivatives in the other direction: $\frac{d t}{d s}, \frac{d^2 t}{d s^2}, \frac{d^3 t}{d s^3}$ and so on.

(It's worth noting that the inverse function $t(s)$ doesn't actually have to exist globally for this to work — that is, $s(t)$ need not be one-to-one. It just needs to be one-to-one locally, so you can define $t(s)$ in a local region, and take derivatives, after which you can forget about $t(s)$. This amounts to requiring that $\frac{d s}{d t} \neq 0$ at the point of study, and indeed our final formulae will diverge if $\frac{d s}{d t} = 0$, indicating this requirement.)

**The first derivative.** Delightfully, it holds that

<div style="text-align: center; margin-bottom: 1.5em;">
<div style="border: 1px solid black; padding: 2px 10px; display: inline-block;">
$$
\frac{ d t}{ds} = \left( \frac{ds}{dt} \right)^{-1},
$$
</div>
</div>

as you can easily confirm by drawing a scalar function and transposing the two axes. I find this result really great because you can just treat $\frac{ds}{dt}$ as a conventional fraction and take its inverse. Shows it's great notation.

**The second derivative.** This one we need to be more careful about. Our main tool is the chain rule: $\frac{d}{ds} = \frac{dt}{ds} \cdot \frac{d}{dt}$. Applying this, we find that $\frac{d^2 t}{ds^2}
= \frac{d}{ds} \frac{d t}{d s}
= \frac{d t}{d s} \cdot \frac{d}{dt} \frac{d t}{d s}
= \left( \frac{d s}{d t} \right)^{-1} \cdot \frac{d}{d t} \left( \frac{d s}{d t} \right)^{-1}$, and evaluating the final derivative we find that

<div style="text-align: center; margin-bottom: 1.5em;">
<div style="border: 1px solid black; padding: 2px 10px; display: inline-block;">
$$
\frac{d^2 t}{ds^2}
= - \left( \frac{d s}{d t} \right)^{-3} \frac{d^2 s}{d t^2}.
$$
</div>
</div>

I find this really nice — the second derivatives are proportional, with the rather surprising constant of proportionality of $- \left( \frac{d s}{d t} \right)^{-3}$. Even though it didn't solve the particular research problem I hoped it would, seems like it might eventually be useful for something. (Wonder if there's some intuition for that other than a dimensionality argument…)

**The third derivative.** Again applying the chain rule, taking $\frac{d^3 t}{ds^3} = \frac{dt}{ds} \cdot \frac{d}{dt} \frac{d^2 s}{dt^2}$, we find that

<div style="text-align: center; margin-bottom: 1.5em;">
<div style="border: 1px solid black; padding: 2px 10px; display: inline-block;">
$$
\frac{d^3 t}{ds^3}
= - \left( \frac{d s}{d t} \right)^{-5} \left[3\left(\frac{d^2 s}{d t^2}\right)^2 - \frac{d s}{d t} \cdot \frac{d^3 s}{dt^3}\right].
$$
</div>
</div>

Not as pretty, and you lose the nice constant of proportionality between $s^{(k)}(t)$ and $t^{(k)}(s)$. Thanks to the chain rule, things only get more complicated from here on out.
