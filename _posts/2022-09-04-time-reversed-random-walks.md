---
layout: post
title: "Time-reversed random walks"
date: 2022-09-03
category: math, fun-science
---

The [random walk](https://en.wikipedia.org/wiki/Random_walk) is a basic stochastic process in which a point explores a space by taking steps in random directions.
This process is used to model a swath of phenomena including the paths of diffusing particles, fluctuating stock prices, and the movements of foraging animals, and it's found use in essentially every discipline of science.
In the classic random walk, a particle starts at the origin at time zero and diffuses outwards.
In this post, we'll look at the statistics of this process when it's run backwards in time.

### The 1D discrete random walk

The simplest random walk is a 1D random walk with discrete steps.
Let $$x_0, x_1, x_2, ..., x_t, ...$$ be integers denoting the position of a random walker on a line at each timestep.
The initial condition and transition dynamics will be

$$x_0 = 0,$$

$$
\begin{equation}
\label{eqn:forward_step}
x_{t+1} =
\left\{
\begin{array}{lr}
x_t, & p = \frac{1}{2} \\
x_t + 1, & p = \frac{1}{2}.
\end{array}
\right.
\end{equation}
$$

In words, the random walker begins at zero and, at each timestep, flips a coin and either remains put or moves to $$x \rightarrow x + 1$$ accordingly.
(It's worth noting that we could've also chosen the possible steps to be not $$\{0,1\}$$ but rather $$\{-1,1\}$$ to ensure that the random walk has mean zero.
It will prove mathematically simpler to use our current formulation, however, but we can always recover the latter setting by constructing $$\tilde{x}_t \equiv 2 x_t - t$$.
We will use $$\tilde{x}_t$$ in our visualizations below.)

This process obeys the following closed-form expression for $$x_t$$ (which is easy to derive recursively):
$$p(x_t) = 2^{-t} \left( \begin{array}{c} t \\ x_t \end{array} \right)$$.

Here's an illustration of this random walk.

<p align="center">
   <img src="{{site.imgurl}}/reversed_rws/rev_rws_fig1a.png" width="30%">
   <img src="{{site.imgurl}}/reversed_rws/rev_rws_fig1b.pdf" width="30%">
</p>
<p style="margin-left:20%; margin-right:20%;">
<small>
<i>
	<b>Left.</b>
	In the 1D discrete random walk, the particle moves left or right at each timestep with probability $1/2$.
	<b>Right.</b>
	Simulated random walks.
	The upper plot shows a histogram of final positions (blue) and the predicted distribution (red)[^d].
</i>
</small>
</p>

### Running it back

The above random walks start at the origin at $$t=0$$ and take uncorrelated steps from then on.
This is easy to simulate, as every step is independent of every other step.
Let us now imagine how these trajectories look to an observer moving backwards in time[^c].
Particles start in a diffuse distribution, take fairly random steps, and magically converge at the origin at $$t=0$$.
Suppose you wish to find the statistics of this process from the point of view of this backwards observer: given that they observe a particle at a given spot at time $$t$$, how will it move?
(Equivalently, we could forget about the time reversal and ask about the statistics of a path conditioned on its intersecting a particular point, but that's less fun.)

Mathematically, we'd like to obtain an update equation similar to Equation $$\ref{eqn:forward_step}$$ which gives us the statistics of $$x_{t-1}$$ as a function of $$x_t$$.
[FOOTNOTE ABOUT THIS BEING A MARKOV PROCESS, SO WE DON'T NEED TO WORRY ABOUT OTHER X'S]
We can do so using [Bayes' rule](https://en.wikipedia.org/wiki/Bayes%27_theorem), which, applied to our case, tells us that

$$p \left( x_{t-1} | x_{t} \right) = \frac{ p \left( x_{t} | x_{t-1} \right) p \left( x_{t} \right) }{ p \left( x_{t-1}\right) }.$$

Some algebra and use of our closed-form expression for $$p(x_t)$$ tells us that

$$
x_{t-1} =
\left\{
\begin{array}{lr}
x_{t} - 1, & p = \frac{x_t}{t} \\
x_{t}, & p = \frac{t - x_t}{t}
\end{array}
\right.
$$

<!-- $$
p \left( x_{-t} | x_{-t+1} \right) = 
\left\{
\begin{array}{lr}
\frac{1}{2}, & x_{-t} = x_{-t+1} \ \ \textrm{ or } \ \ x_{-t} = x_{-t+1}-1\\
0, & \textrm{else.} \\
\end{array}
\right.
$$

$$p \left( x_{-t} \right) = $$

$$
p \left( x_{-t+1} | x_{-t} \right) =
\frac{
	\frac{1}{t!} \left( \begin{array}{c} t \\ x_{-t} \end{array} \right)
}{
	2	\frac{1}{(t-1)!} \left( \begin{array}{c} t-1 \\ x_{-t+1} \end{array} \right)
}
=
$$ -->

Examining these transition probabilities, we see that, when run backwards in time, our random walk is biased towards taking a step right if $$x_t < \frac{t}{2}$$ and biased left if $$x_t > \frac{t}{2}$$, and that the probability of a step left interpolates linearly from $$0$$ to $$1$$ as $$x_t$$ increases from $$0$$ to $$t$$.
These centerwards biases ensure the particle remains in the "lightcone" leading into the origin.
When $$x_t \approx \frac{t}{2}$$, the step is roughly unbiased, and backward propagation is simply the same random walk as the forward propagation.
We generally expect $$x_t \approx \frac{t}{2}$$ at large $$t$$, and so the biasedness of the reverse process only comes into play at small $$t$$ or when $$x_t$$ drifts unusually close to the edges of $$[0,t]$$.

Here is a simulation of a backward random walk with [PARAMETERS].

### Random walk with Gaussian steps



### The continuum limit


[intro to the 1D random walk]
[solution for discrete steps]
[simulation]

[what does it mean to go backwards?]

[random walk backwards in time]
"backwards in time," diffusing with the constraint that it must reach the origin at a 

[solution for Gaussian steps]



Time-reversed random walks

Normal RWs are forwards in time. Here's what they look like.

Inspired by Tenet, I started to think about time-reversed (quasi)random processes.
What if we simulate a random walk backwards in time, with the constraint that it reaches zero at time t?
What are its statistics? Can we simulate it forwards?

Yes. Here's how.

[example for binary steps]

[example for Gaussian steps?]

[time-reversed Weiner process?]


[^a]: This post was inspired by the movie *Tenet*.

[^b]: We might have let the possible steps be $$\{-1,1\}$$ instead of $$\{0,1\}$$. This yields a centered random walk but a slightly more complicated final expression, so we stick with $$\{0,1\}$$ for the math.

[^c]: If you were wondering, yes, this question was inspired by the movie *Tenet*, which forces you to think about the dynamics of things from the point of view of an observer moving the other way through time.

[^d]: The theoretical distribution here is actually a Gaussian distribution obtained by expanding the true discrete formula around its mean, which is why it's continuous. This Gaussian is both easier to deal with mathematically and nicer to plot.